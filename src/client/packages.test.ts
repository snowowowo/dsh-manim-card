/**
 * 包清单、依赖闭包、取包与清缓存。这几件事错起来都很安静：
 *  - 闭包漏了依赖 ⇒「提前缓存」白做（真要 import 时还得联网），多算了 ⇒ 白下几十 MB；
 *  - 清单解析放松了 ⇒ 界面拿着一堆 `undefined` 去渲染；
 *  - 取包/清缓存的响应形状歪了 ⇒ 明明没落地却报成功，或者悄悄返回空。
 * 纯逻辑与响应处理都在这里测，网络一律打桩。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cachePackage, clearPackage, clearPackageCache, COMMON_PACKAGES, completionFor, findPackage, formatBytes, parseInventory,
  prefetchPlan, type PackageEntry,
} from './packages'

const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** 假 fetch：只关心 ok / status / json 三样。 */
const respond = (body: unknown, init?: { ok?: boolean; status?: number }): void => {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({ ok: init?.ok ?? true, status: init?.status ?? 200, json: () => Promise.resolve(body) }),
  )
}

/** 同 respond，但把调用参数收下来给断言看（请求的发法也是契约的一部分）。 */
const respondAndSpy = (body: unknown, init?: { ok?: boolean; status?: number }): ReturnType<typeof vi.fn> => {
  const spy = vi.fn(() =>
    Promise.resolve({ ok: init?.ok ?? true, status: init?.status ?? 200, json: () => Promise.resolve(body) }),
  )
  vi.stubGlobal('fetch', spy)
  return spy
}

function entry(name: string, options: { depends?: string[]; state?: PackageEntry['state'] } = {}): PackageEntry {
  return {
    name,
    version: '1.0.0',
    fileName: `${name}-1.0.0-py3-none-any.whl`,
    kind: 'package',
    depends: options.depends ?? [],
    imports: [],
    state: options.state ?? 'absent',
    bytes: null,
  }
}

describe('依赖闭包', () => {
  it('依赖排在前面：中途停下来时，已落地的部分是一个自洽的前缀', () => {
    const entries = [
      entry('matplotlib', { depends: ['numpy', 'contourpy'] }),
      entry('numpy'),
      entry('contourpy', { depends: ['numpy'] }),
    ]
    expect(prefetchPlan(entries, 'matplotlib')).toEqual(['numpy', 'contourpy', 'matplotlib'])
  })

  it('已在本地的包不进计划，但它的依赖仍然要往下看', () => {
    // 中间那一环缓存了、它的依赖没有：只看顶层会漏掉 c，于是「取 a」之后仍要联网
    const entries = [entry('a', { depends: ['b'] }), entry('b', { depends: ['c'], state: 'cached' }), entry('c')]
    expect(prefetchPlan(entries, 'a')).toEqual(['c', 'a'])
  })

  it('整条链都在本地时，计划是空的（调用方据此说「已经在本机了」）', () => {
    const entries = [entry('sympy', { depends: ['mpmath'], state: 'bundled' }), entry('mpmath', { state: 'bundled' })]
    expect(prefetchPlan(entries, 'sympy')).toEqual([])
  })

  it('依赖成环也转得出来（不死循环）', () => {
    const entries = [entry('a', { depends: ['b'] }), entry('b', { depends: ['a'] })]
    expect(new Set(prefetchPlan(entries, 'a'))).toEqual(new Set(['a', 'b']))
  })

  it('清单里没有这个包就回空计划，不拿半个闭包去取', () => {
    expect(prefetchPlan([entry('numpy')], 'nope')).toEqual([])
  })

  it('依赖名在清单里查不到就跳过（lock 换了版本也不该把计划做崩）', () => {
    expect(prefetchPlan([entry('a', { depends: ['ghost', 'numpy'] }), entry('numpy')], 'a')).toEqual(['numpy', 'a'])
  })

  it('写法不一致的依赖也算数：清单里叫 Pillow、depends 里写 pillow（真实发生过的那种）', () => {
    // 归一化之前这一条会漏包——「提前缓存 matplotlib」白做，真要 import 时还得联网
    const entries = [entry('matplotlib', { depends: ['pillow'] }), entry('Pillow')]
    expect(prefetchPlan(entries, 'matplotlib')).toEqual(['Pillow', 'matplotlib'])
  })

  it('找包时名字任一写法都认（用户会写 Pillow / scikit_learn）', () => {
    const entries = [entry('scikit-learn', { depends: ['numpy'] }), entry('numpy')]
    expect(prefetchPlan(entries, 'scikit_learn')).toEqual(['numpy', 'scikit-learn'])
  })
})

describe('输入框补全（虚影）', () => {
  const entries = [entry('pandas'), entry('pillow'), entry('pytz'), entry('scikit-learn')]

  it('按前缀补：给出完整名字与要接上去的那一段', () => {
    expect(completionFor(entries, 'pan')).toEqual({ name: 'pandas', suffix: 'das' })
    expect(completionFor(entries, 'sci')).toEqual({ name: 'scikit-learn', suffix: 'kit-learn' })
  })

  it('不分大小写（用户可能大写开头）', () => {
    expect(completionFor(entries, 'PAN')?.name).toBe('pandas')
    // 大写打字时补出来的是规范名字，采纳后输入框里就是规范写法
    expect(completionFor(entries, 'Pand')).toEqual({ name: 'pandas', suffix: 'as' })
  })

  it('已经是个完整名字就不补（否则会一直挂着一截空虚影）', () => {
    expect(completionFor(entries, 'pandas')).toBeNull()
    expect(completionFor(entries, 'PANDAS')).toBeNull()
  })

  it('空输入、或谁都对不上时都不补', () => {
    expect(completionFor(entries, '')).toBeNull()
    expect(completionFor(entries, 'seaborn')).toBeNull()
  })

  it('只做前缀匹配，不做包含匹配：`illow` 不该被补成中间的 pillow', () => {
    // 往中间插的那种补全在虚影上没法表达，宁可不补
    expect(completionFor(entries, 'illow')).toBeNull()
    expect(completionFor(entries, 'learn')).toBeNull()
  })

  it('前面多打了空格就不补——虚影是按输入框里的字往后接的，trim 过就对不齐了', () => {
    expect(completionFor(entries, ' pandas')).toBeNull()
  })

  it('候选多个时取字典序第一个：同一份输入永远同一个结果', () => {
    // 清单本来就是按名字排序发过来的
    expect(completionFor(entries, 'p')?.name).toBe('pandas')
  })
})

describe('按名字找一条记录', () => {
  it('大写 / 下划线 / 点号写法都能对上', () => {
    const entries = [entry('pillow'), entry('astropy-iers-data'), entry('python-dateutil')]
    expect(findPackage(entries, 'Pillow')?.name).toBe('pillow')
    expect(findPackage(entries, 'astropy_iers_data')?.name).toBe('astropy-iers-data')
    expect(findPackage(entries, 'python_dateutil')?.name).toBe('python-dateutil')
    expect(findPackage(entries, '  pillow ')?.name).toBe('pillow')
  })

  it('找不到回 undefined（调用方据此说「不认识这个包名」，而不是发个请求出去）', () => {
    expect(findPackage([entry('numpy')], 'seaborn')).toBeUndefined()
    expect(findPackage([], 'numpy')).toBeUndefined()
  })
})

describe('清单解析（外部输入）', () => {
  it('单条不合格只丢那一条，不整表作废', () => {
    const parsed = parseInventory({
      cacheDir: '/tmp/cache',
      pyodideVersion: '0.27.7',
      entries: [
        { name: 'numpy', fileName: 'numpy.whl', state: 'bundled', version: '2.0.2', bytes: 12, depends: ['x', 5], imports: null },
        { name: '', fileName: 'x.whl', state: 'cached' },
        { name: 'bad', fileName: 'bad.whl', state: 'weird' },
        { name: 'nofile', state: 'cached' },
        'nonsense',
      ],
    })
    expect(parsed?.entries).toHaveLength(1)
    expect(parsed?.entries[0]).toEqual({
      name: 'numpy', version: '2.0.2', fileName: 'numpy.whl', kind: 'package',
      depends: ['x'], imports: [], state: 'bundled', bytes: 12,
    })
  })

  it('bytes 给了个不是数的东西就当没有（界面上显示「—」而不是 NaN MB）', () => {
    const parsed = parseInventory({ cacheDir: '/x', entries: [{ name: 'a', fileName: 'a.whl', state: 'cached', bytes: 'big' }] })
    expect(parsed?.entries[0]?.bytes).toBeNull()
  })

  it('形状不对回 null（调用方据此报错，而不是拿半个对象去渲染）', () => {
    expect(parseInventory(null)).toBeNull()
    expect(parseInventory('nope')).toBeNull()
    expect(parseInventory({ entries: [] })).toBeNull()
    expect(parseInventory({ cacheDir: '/x' })).toBeNull()
  })
})

describe('字节数成人话', () => {
  it('跨单位进得去，也停在 GB', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(900)).toBe('900 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(9 * 1024 * 1024 + 900 * 1024)).toBe('9.9 MB')
    expect(formatBytes(2.5 * 1024 ** 3)).toBe('2.5 GB')
  })
})

describe('常用包清单', () => {
  it('每个名字都真的在随包 lock 里，而且是能装的产物', () => {
    // 名字必须是 lock 的**键**：`sklearn` / `PIL` / `seaborn` 这类在这里都查不到
    // （前两个是 import 名、第三个 Pyodide 压根没有）。写错了的表现是界面上那一行
    // 永远「未缓存」、点了报「不认识这个包名」——而只有点了才知道，所以在这里核。
    const lock = JSON.parse(readFileSync(join(PLUGIN_DIR, 'assets', 'pyodide', 'pyodide-lock.json'), 'utf8')) as {
      packages: Record<string, { file_name: string }>
    }
    const missing = COMMON_PACKAGES.filter((name) => lock.packages[name] === undefined)
    expect(missing).toEqual([])
    // 只列可下载的：`*-tests` 的产物是 .tar，取回来也装不进运行时
    for (const name of COMMON_PACKAGES) {
      expect(lock.packages[name]!.file_name, name).toMatch(/\.(whl|zip)$/u)
    }
  })

  it('是个短清单：重复项没有，条数控制在十个出头', () => {
    expect(new Set(COMMON_PACKAGES).size).toBe(COMMON_PACKAGES.length)
    expect(COMMON_PACKAGES.length).toBeLessThanOrEqual(12)
  })
})

describe('cachePackage：取一个包', () => {
  it('请求就是 POST 到清单同级的 /cache，一次一个包名', async () => {
    const spy = respondAndSpy({ results: [{ state: 'cached', bytes: 10 }] })
    await cachePackage('numpy')
    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/dsh-plugins/manim-renderer/packages/cache')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ names: ['numpy'] })
  })

  it('成功时回字节数', async () => {
    respond({ results: [{ state: 'cached', bytes: 2048 }] })
    expect(await cachePackage('numpy')).toEqual({ ok: true, bytes: 2048, error: '' })
  })

  it('Host 报了错就把它原样带出来（它比我更清楚哪里断了）', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    respond({ results: [{ state: 'absent', bytes: 0, error: 'sha256 对不上' }] })
    expect(await cachePackage('numpy')).toEqual({ ok: false, bytes: 0, error: 'sha256 对不上' })
  })

  it('HTTP 失败不抛、回一句结果——批量取时一次失败不该把整轮断在半路', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    respond({}, { ok: false, status: 500 })
    expect(await cachePackage('numpy')).toEqual({ ok: false, bytes: 0, error: 'HTTP 500' })
  })

  it('连不上也回结果，不停在原地', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    expect(await cachePackage('numpy')).toEqual({ ok: false, bytes: 0, error: 'offline' })
  })

  it('没有 results 时算失败，不能当成功（否则界面会说「已缓存」而其实没落地）', async () => {
    respond({})
    expect(await cachePackage('numpy')).toEqual({ ok: false, bytes: 0, error: 'Host 没有回报结果' })
  })

  it('字节数不是数就按 0 记，不显示 NaN', async () => {
    respond({ results: [{ state: 'cached', bytes: 'big' }] })
    expect((await cachePackage('numpy')).bytes).toBe(0)
  })
})

describe('clearPackage：按行清理一个包', () => {
  it('就是 POST 一次，体里带上名字（名字按用户写的样子发出去，Host 会归一化）', async () => {
    const spy = respondAndSpy({ removed: ['pillow-10.2.0-cp312-cp312-pyodide_2024_0_wasm32.whl'] })
    expect(await clearPackage('Pillow')).toEqual(['pillow-10.2.0-cp312-cp312-pyodide_2024_0_wasm32.whl'])
    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/dsh-plugins/manim-renderer/cache')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ names: ['Pillow'] })
  })

  it('HTTP 失败要抛：界面据此说「清理失败」，不能当成清掉了', async () => {
    respond({}, { ok: false, status: 500 })
    await expect(clearPackage('pillow')).rejects.toThrow('HTTP 500')
  })

  it('连不上也要抛', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    await expect(clearPackage('pillow')).rejects.toThrow('offline')
  })
})

describe('clearPackageCache：清缓存的响应', () => {
  it('返回被删掉的文件名', async () => {
    respond({ removed: ['a.whl', 'b.whl'] })
    expect(await clearPackageCache()).toEqual(['a.whl', 'b.whl'])
  })

  it('就是 POST 一次，不带正文', async () => {
    const spy = respondAndSpy({ removed: [] })
    await clearPackageCache()
    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/dsh-plugins/manim-renderer/cache')
    expect(init.method).toBe('POST')
  })

  it('响应里混了非字符串也收得住', async () => {
    respond({ removed: ['a.whl', 7, null, { x: 1 }] })
    expect(await clearPackageCache()).toEqual(['a.whl'])
  })

  it('没有 removed 字段就当没删到东西', async () => {
    respond({})
    expect(await clearPackageCache()).toEqual([])
  })

  it('响应根本不是对象也回空表，不炸页面', async () => {
    respond('nope')
    expect(await clearPackageCache()).toEqual([])
  })

  it('HTTP 失败要抛，不能报成「清掉了 0 个」', async () => {
    respond({}, { ok: false, status: 500 })
    await expect(clearPackageCache()).rejects.toThrow('HTTP 500')
  })

  it('连不上也要抛', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    await expect(clearPackageCache()).rejects.toThrow('offline')
  })
})
