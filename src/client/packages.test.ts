/**
 * 包清单、依赖闭包、取包与清缓存。这几件事错起来都很安静：
 *  - 闭包漏了依赖 ⇒「提前缓存」白做（真要 import 时还得联网），多算了 ⇒ 白下几十 MB；
 *  - 清单解析放松了 ⇒ 界面拿着一堆 `undefined` 去渲染；
 *  - 取包/清缓存的响应形状歪了 ⇒ 明明没落地却报成功，或者悄悄返回空。
 * 纯逻辑与响应处理都在这里测，网络一律打桩。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cachePackage, clearPackageCache, formatBytes, parseInventory, prefetchPlan, stateKey, type PackageEntry } from './packages'
import { DICT } from './i18n'

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

describe('文案键', () => {
  it('状态键真的在词典里——拼错一个键就是界面上少一句话', () => {
    for (const state of ['bundled', 'cached', 'absent'] as const) {
      expect(DICT.zh).toHaveProperty(stateKey(state))
    }
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
