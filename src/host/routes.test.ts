/**
 * Host 半边接线：`apply()` 到底注册了什么，以及每条注册出来的 handler **真跑一遍**的行为边界。
 *
 * 为什么值得测：Host 是插件的**入口**，注册错了的表现都很隐蔽——工具没注册就是「模型不会用」，
 * 技能没注册就是「模型不知道写法边界」，资源路由错了就是「卡在加载 Pyodide / 公式变豆腐块」。
 * 所以这里用假 ctx 走一遍 `apply()`，拿真实注册出来的 handler 真跑，并且真的在临时目录里读写。
 *
 * 范围（按 handler 的职责边界）：
 *  - manim_render 工具：空源码当场拒、干跑通过/失败的回执形状；
 *  - 技能注册：SKILL.md 的 frontmatter 被剥掉、正文原样交出去；服务缺席要优雅降级；
 *  - 常驻指引：注册到 systemPrompt；
 *  - KaTeX / Pyodide 两条静态资源路由：只放行 GET、越界拒绝、缓存优先于回源、回源失败给 502；
 *  - 语料路由 + 清包缓存路由（见下方两组）；
 *  - 设置页那两条：包清单（随包 / 已缓存 / 未缓存）与预缓存（跳过已在本地的、拒绝 lock 里没有的名字、
 *    校验不过就报错且不落盘、失败即停、坏正文给 400）；以及本机环境探测（计划不跑命令、找得到 python3、不认识的项 404）。
 *
 * 核心包 `manim-live/node` 被替身接走：工具执行里的 `runPython` 不真起 Pyodide、`setPyodideLoader`
 * 只记录（否则这一份会变成几秒级的集成测试）。资源路由用的是真的 node:stream，文件也是真的。
 *
 * **预缓存「真的下成功」那一格**：离线造不出 sha256 对得上的字节（那等于求 sha256 的原像）。
 * 所以拆成两条——离线钉**目录本身不许缺摘要**（曾经 CATALOG 漏带 sha256，于是每次预缓存都必然
 * 失败、还只报「期望 undefined」；只有「对不上要报错」的用例根本拦不住），真下载那条放进
 * `MANIM_NET=1` 的联网组（挑最小的包，几 KB）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Writable } from 'node:stream'
import { apply } from './index.js'
import { pythonBesideExecutable, resolveExecutable } from './environment.js'
import { CATALOG } from './pyodide.js'
// 上面那份替身里的函数要在测试里直接驱动（断言被调用、改返回值）——vi.mock 会被提升，顺序无所谓
import { runPython, setPyodideLoader } from 'manim-live/node'

vi.mock('manim-live/node', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    runPython: vi.fn(),
    createDryRunBridge: vi.fn(() => ({ __dryRun: true })),
    setPyodideLoader: vi.fn(actual.setPyodideLoader as (loader: unknown) => void),
  }
})

const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const KATEX_DIR = join(PLUGIN_DIR, 'assets', 'katex')
const PYODIDE_DIR = join(PLUGIN_DIR, 'assets', 'pyodide')

const CORPUS_PATH = '/dsh-plugins/manim-live/corpus'
const CACHE_PATH = '/dsh-plugins/manim-live/cache'
const KATEX_PATH = '/dsh-plugins/manim-live/katex'
const PYODIDE_PATH = '/dsh-plugins/manim-live/pyodide'
const PACKAGES_PATH = '/dsh-plugins/manim-live/packages'
const ENV_PATH = '/dsh-plugins/manim-live/environment'
const EXPORT_PATH = '/dsh-plugins/manim-live/export'

interface Handler {
  (request: { method: string; url: string }, response: unknown): Promise<void>
}
interface Route {
  kind: string
  path: string
  handler: Handler
}
interface Tool {
  name: string
  parameters: unknown
  output: { render: (args: unknown, value: unknown) => unknown }
  execute: (args: unknown) => Promise<unknown>
}

interface Captured {
  routes: Route[]
  tools: Tool[]
  sections: Array<{ name?: string; order?: number; text?: string }>
  skills: Array<Record<string, unknown>>
}

let homeRoot = ''
let cacheDir = ''
let captured: Captured

/**
 * 假 ctx：把注册动作收下来，`get` 只答本插件真正会问的那几个服务。
 * `options.home` / `options.skills` 传 false 用来演「服务缺席」的降级路径。
 */
function fakeCtx(options: { home?: boolean; skills?: boolean } = {}): unknown {
  const withHome = options.home !== false
  const withSkills = options.skills !== false
  return {
    // apply 里的注册有两种写法：普通箭头函数，和 `function* () { yield ... }` 的生成器。
    // 生成器是**惰性**的——不把迭代走完，里面的 register 根本不会执行（踩过一次）。
    effect: (fn: () => unknown) => {
      const result = fn()
      if (result !== null && typeof result === 'object' && Symbol.iterator in result) {
        for (const _step of result as Iterable<unknown>) void _step
      }
    },
    get: (service: string) => {
      if (service === 'dshHomePath' && withHome) return (...parts: string[]) => join(homeRoot, ...parts)
      if (service === 'skills' && withSkills) {
        return { register: (skill: unknown) => captured.skills.push(skill as Record<string, unknown>) }
      }
      return undefined
    },
    tools: { register: (tool: unknown) => captured.tools.push(tool as Tool) },
    systemPrompt: { section: (section: unknown) => captured.sections.push(section as Captured['sections'][number]) },
    webServer: {
      register: (route: Route) => {
        captured.routes.push(route)
      },
    },
  }
}

/** 假响应：够这些路由用（只看 statusCode / setHeader / end）；statusCode 默认 200，同真实 Node。 */
function responseStub() {
  return {
    statusCode: 200,
    body: '',
    headers: {} as Record<string, string>,
    setHeader(this: { headers: Record<string, string> }, key: string, value: string) {
      this.headers[key] = value
    },
    end(this: { body: string }, body?: string) {
      this.body = body ?? ''
    },
  }
}

/**
 * 请求照 node:http 的形状造：**异步可迭代**，这样 `readJsonBody` 那条 for-await 走的是真路径
 * （直接塞个 `{ method, url }` 会在 for-await 上抛「不是异步可迭代」，测不到真行为）。
 * `body` 会过一遍 `JSON.stringify`；要喂**原文**（坏 JSON / 超限）用 `callRaw`。
 */
function call(route: Route, method: string, url: string, body?: unknown) {
  const response = responseStub()
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body), 'utf8')]
  const request = {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk
    },
  }
  return route.handler(request, response).then(() => response)
}

/** 正文按**原文**喂进去：坏正文 / 超限这两类要的就是「客户端发来的东西不干净」。 */
function callRaw(route: Route, method: string, url: string, raw: string | Buffer) {
  const response = responseStub()
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'utf8')
  const request = {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      yield buffer
    },
  }
  return route.handler(request, response).then(() => response)
}

/**
 * 资源路由的响应替身：这两条会 `readable.pipe(response)`，所以必须是个真的 Writable
 * （简单的 { end(){} } 对象接不住 pipe）。body 由写进去的块拼出来。
 */
async function callStream(route: Route, method: string, url: string) {
  const chunks: Buffer[] = []
  const response = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(Buffer.from(chunk))
      callback()
    },
  }) as Writable & { statusCode: number; headers: Record<string, string>; setHeader(key: string, value: string): void }
  response.statusCode = 200
  response.headers = {}
  response.setHeader = function (this: { headers: Record<string, string> }, key: string, value: string) {
    this.headers[key] = value
  }
  const finished = new Promise<void>((resolve, reject) => {
    response.on('finish', () => resolve())
    response.on('error', reject)
  })
  await route.handler({ method, url }, response)
  await finished
  return { statusCode: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }
}

function routeAt(path: string): Route {
  const route = captured.routes.find((item) => item.path === path)
  if (route === undefined) throw new Error(`没注册路由 ${path}（注册了的：${captured.routes.map((r) => r.path).join(', ')}）`)
  return route
}

beforeEach(() => {
  homeRoot = mkdtempSync(join(tmpdir(), 'manim-home-'))
  cacheDir = join(homeRoot, 'cache', 'manim-live', 'pyodide')
  captured = { routes: [], tools: [], sections: [], skills: [] }
  // apply 会打几条 info（缓存目录、技能已注册）——测试输出里不需要它们
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(runPython).mockReset()
  vi.mocked(setPyodideLoader).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  rmSync(homeRoot, { recursive: true, force: true })
})

describe('apply 接线', () => {
  it('注册了工具 / 技能 / 常驻指引，以及五条路由', () => {
    apply(fakeCtx())
    expect(captured.tools).toHaveLength(1)
    expect(captured.skills).toHaveLength(1)
    expect(captured.sections).toHaveLength(1)
    expect(captured.routes.map((route) => route.path)).toEqual(
      expect.arrayContaining([KATEX_PATH, PYODIDE_PATH, CORPUS_PATH, CACHE_PATH, ENV_PATH, EXPORT_PATH]),
    )
  })

  it('把 Pyodide 加载器交给运行时（缓存目录挂在 dshHomePath 下）', () => {
    apply(fakeCtx())
    expect(setPyodideLoader).toHaveBeenCalledTimes(1)
    expect(vi.mocked(console.info).mock.calls.flat().join(' ')).toContain(cacheDir)
  })

  it('没有 dshHomePath 服务时退回 $DSH_HOME 下（服务缺席也不能把缓存写进插件目录）', () => {
    process.env.DSH_HOME = join(homeRoot, 'custom-home')
    try {
      apply(fakeCtx({ home: false }))
      expect(vi.mocked(console.info).mock.calls.flat().join(' ')).toContain(
        join(homeRoot, 'custom-home', 'cache', 'manim-live', 'pyodide'),
      )
    } finally {
      delete process.env.DSH_HOME
    }
  })
})

describe('manim_render 工具', () => {
  async function run(args: unknown): Promise<unknown> {
    apply(fakeCtx())
    return captured.tools[0]!.execute(args)
  }

  it('名字与入参形状', () => {
    apply(fakeCtx())
    const tool = captured.tools[0]!
    expect(tool.name).toBe('manim_render')
    expect(tool.parameters).toMatchObject({ required: ['python'] })
  })

  it('空源码当场拒（不用等干跑）', async () => {
    expect(await run({ python: '' })).toEqual({ ok: false, error: 'python 不能为空' })
    expect(await run({ python: '   \n ' })).toEqual({ ok: false, error: 'python 不能为空' })
    expect(runPython).not.toHaveBeenCalled()
  })

  it('python 不是字符串也当场拒', async () => {
    expect(await run({})).toEqual({ ok: false, error: 'python 不能为空' })
    expect(await run({ python: 42 })).toEqual({ ok: false, error: 'python 不能为空' })
  })

  it('干跑通过 = ok:true', async () => {
    vi.mocked(runPython).mockResolvedValue(undefined)
    expect(await run({ python: 'from manim import *' })).toEqual({ ok: true })
    expect(runPython).toHaveBeenCalledTimes(1)
  })

  it('干跑失败 = ok:false + error 原文（同轮自我修正就靠它）', async () => {
    vi.mocked(runPython).mockRejectedValue(new Error('第 3 行：NameError: name x is not defined'))
    expect(await run({ python: 'x' })).toEqual({ ok: false, error: '第 3 行：NameError: name x is not defined' })
  })

  it('抛的不是 Error 也收得住', async () => {
    vi.mocked(runPython).mockRejectedValue('weird')
    expect(await run({ python: 'x' })).toEqual({ ok: false, error: 'weird' })
  })

  it('回执渲染成一段 JSON 文本', () => {
    apply(fakeCtx())
    expect(captured.tools[0]!.output.render({}, { ok: false, error: 'x' })).toEqual([
      { type: 'text', text: '{"ok":false,"error":"x"}' },
    ])
  })
})

describe('技能注册', () => {
  it('SKILL.md 的 frontmatter 被剥掉，正文原样交出去', () => {
    apply(fakeCtx())
    const skill = captured.skills[0]!
    expect(skill.name).toBe('manim-live')
    expect(skill.source).toBe('runtime')
    expect(typeof skill.content).toBe('string')
    expect((skill.content as string).length).toBeGreaterThan(0)
    // frontmatter 不能漏进正文（`---` 开头的 YAML 会被当成正文读给模型）
    expect((skill.content as string).startsWith('---')).toBe(false)
    expect(typeof skill.description).toBe('string')
    expect((skill.description as string).length).toBeGreaterThan(0)
  })

  it('skills 服务缺席时打日志、不注册——AI 退回只靠工具描述，但不能把插件带崩', () => {
    apply(fakeCtx({ skills: false }))
    expect(captured.skills).toHaveLength(0)
    expect(vi.mocked(console.error).mock.calls.flat().join(' ')).toContain('skills')
  })
})

describe('常驻指引', () => {
  it('以固定名与顺序注册到 systemPrompt，正文非空', () => {
    apply(fakeCtx())
    const section = captured.sections[0]!
    expect(section.name).toBe('manim-live:guide')
    expect(section.order).toBe(520)
    expect(typeof section.text).toBe('string')
    expect(section.text!.length).toBeGreaterThan(0)
    // 指引必须点到工具名，否则模型不知道要调哪个（这是标识符，不是措辞）
    expect(section.text).toContain('manim_render')
  })
})

describe('KaTeX 静态资源路由', () => {
  it('GET 到真文件：按扩展名给 content-type，内容与磁盘一致', async () => {
    apply(fakeCtx())
    const response = await callStream(routeAt(KATEX_PATH), 'GET', `${KATEX_PATH}/katex.min.css`)
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/css')
    expect(response.body.equals(readFileSync(join(KATEX_DIR, 'katex.min.css')))).toBe(true)
  })

  it('路径越界（../ 出去）拒绝', async () => {
    apply(fakeCtx())
    const response = await callStream(routeAt(KATEX_PATH), 'GET', `${KATEX_PATH}/../pyodide/pyodide.mjs`)
    expect(response.statusCode).toBe(404)
    expect(response.body.length).toBe(0)
  })

  it('文件不存在给 404', async () => {
    apply(fakeCtx())
    expect((await callStream(routeAt(KATEX_PATH), 'GET', `${KATEX_PATH}/nope.css`)).statusCode).toBe(404)
  })

  it('非 GET 一律 405', async () => {
    apply(fakeCtx())
    expect((await callStream(routeAt(KATEX_PATH), 'POST', `${KATEX_PATH}/katex.min.css`)).statusCode).toBe(405)
  })
})

describe('Pyodide 资源路由', () => {
  /** 命中随包目录：Pyodide 本体与随包的三个 wheel。 */
  it('随包目录优先：pyodide.mjs 与随包 wheel 直接发出去', async () => {
    apply(fakeCtx())
    const route = routeAt(PYODIDE_PATH)
    const script = await callStream(route, 'GET', `${PYODIDE_PATH}/pyodide.mjs`)
    expect(script.statusCode).toBe(200)
    expect(script.headers['content-type']).toContain('text/javascript')
    expect(script.body.equals(readFileSync(join(PYODIDE_DIR, 'pyodide.mjs')))).toBe(true)

    // wasm 必须是 application/wasm，否则浏览器不走流式编译
    const wasm = await callStream(route, 'GET', `${PYODIDE_PATH}/pyodide.asm.wasm`)
    expect(wasm.headers['content-type']).toBe('application/wasm')

    const wheel = await callStream(route, 'GET', `${PYODIDE_PATH}/sympy-1.13.3-py3-none-any.whl`)
    expect(wheel.statusCode).toBe(200)
    expect(wheel.headers['content-type']).toBe('application/octet-stream')
  })

  it('带查询串也认（Pyodide 有时会带 ?v=）', async () => {
    apply(fakeCtx())
    expect((await callStream(routeAt(PYODIDE_PATH), 'GET', `${PYODIDE_PATH}/pyodide.mjs?v=2`)).statusCode).toBe(200)
  })

  it('缓存目录里的按需包直接发（不回源）', async () => {
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(join(cacheDir, 'pandas-2.2.3-cp312-cp312-pyodide_2024_0_wasm32.whl'), 'cached')
    apply(fakeCtx())
    const response = await callStream(routeAt(PYODIDE_PATH), 'GET', `${PYODIDE_PATH}/pandas-2.2.3-cp312-cp312-pyodide_2024_0_wasm32.whl`)
    expect(response.statusCode).toBe(200)
    expect(response.body.toString('utf8')).toBe('cached')
  })

  it('lock 里没有的名字给 404（不打 CDN）', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    apply(fakeCtx())
    expect((await callStream(routeAt(PYODIDE_PATH), 'GET', `${PYODIDE_PATH}/whatever.bin`)).statusCode).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('带斜杠的路径不当包处理（越界也就无从谈起）', async () => {
    apply(fakeCtx())
    expect((await callStream(routeAt(PYODIDE_PATH), 'GET', `${PYODIDE_PATH}/sub/dir.whl`)).statusCode).toBe(404)
  })

  it('非 GET 一律 405', async () => {
    apply(fakeCtx())
    expect((await callStream(routeAt(PYODIDE_PATH), 'POST', `${PYODIDE_PATH}/pyodide.mjs`)).statusCode).toBe(405)
  })

  /** 一个 lock 里有、但随包目录与缓存目录都没有的包名——只有这种才会走回源。 */
  function remoteOnlyName(): string {
    const lock = JSON.parse(readFileSync(join(PYODIDE_DIR, 'pyodide-lock.json'), 'utf8')) as {
      packages: Record<string, { file_name: string }>
    }
    const bundled = new Set(readdirSync(PYODIDE_DIR))
    const found = Object.values(lock.packages).map((entry) => entry.file_name).find((name) => !bundled.has(name))
    if (found === undefined) throw new Error('lock 里没有「随包目录没有」的包，回源路径没法测')
    return found
  }

  it('回源失败给 502（不是把半截文件当成功）', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    apply(fakeCtx())
    const response = await callStream(routeAt(PYODIDE_PATH), 'GET', `${PYODIDE_PATH}/${remoteOnlyName()}`)
    expect(response.statusCode).toBe(502)
    expect(vi.mocked(console.error).mock.calls.flat().join(' ')).toContain('pyodide asset failed')
    // 失败不能在缓存目录里留下东西
    expect(existsSync(cacheDir) === false || readdirSync(cacheDir).length === 0).toBe(true)
  })

  it('回源内容 sha256 对不上就 502，并且不落盘', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)),
      }),
    )
    apply(fakeCtx())
    const response = await callStream(routeAt(PYODIDE_PATH), 'GET', `${PYODIDE_PATH}/${remoteOnlyName()}`)
    expect(response.statusCode).toBe(502)
    expect(existsSync(cacheDir) === false || readdirSync(cacheDir).length === 0).toBe(true)
  })

  it('回源拿到非 2xx 也 502', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ ok: false, status: 404, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }),
    )
    apply(fakeCtx())
    const response = await callStream(routeAt(PYODIDE_PATH), 'GET', `${PYODIDE_PATH}/${remoteOnlyName()}`)
    expect(response.statusCode).toBe(502)
  })
})

describe('语料路由', () => {
  it('GET 给回语料 JSON（开发机上取得到）', async () => {
    apply(fakeCtx())
    const response = await call(routeAt(CORPUS_PATH), 'GET', CORPUS_PATH)
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/json')
    // 语料在改，别让浏览器缓存住旧的
    expect(response.headers['cache-control']).toBe('no-store')
    const body = JSON.parse(response.body)
    expect(body.groups.length).toBeGreaterThan(0)
    expect(body.examples.length).toBeGreaterThan(0)
  })

  it('没有语料目录时给空表（正式安装的常态，不是错）', async () => {
    process.env.MANIM_CORPUS = join(tmpdir(), 'manim-corpus-absent')
    try {
      apply(fakeCtx())
      const response = await call(routeAt(CORPUS_PATH), 'GET', CORPUS_PATH)
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ groups: [], examples: [] })
    } finally {
      delete process.env.MANIM_CORPUS
    }
  })

  it('非 GET 一律 405', async () => {
    apply(fakeCtx())
    const response = await call(routeAt(CORPUS_PATH), 'POST', CORPUS_PATH)
    expect(response.statusCode).toBe(405)
  })
})

describe('清包缓存路由', () => {
  /** 铺一个像样的缓存目录：两个 whl + 一个别的文件 + 一个子目录（都不该被动）。 */
  function seedCache(): void {
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(join(cacheDir, 'sympy-1.13.3-py3-none-any.whl'), 'w')
    writeFileSync(join(cacheDir, 'mpmath-1.3.0-py3-none-any.whl'), 'w')
    writeFileSync(join(cacheDir, 'README.txt'), '不是包')
    mkdirSync(join(cacheDir, 'nested-dir'))
  }

  it('POST 只删 *.whl，别的一律不动', async () => {
    seedCache()
    apply(fakeCtx())
    const response = await call(routeAt(CACHE_PATH), 'POST', CACHE_PATH)
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body).removed.sort()).toEqual([
      'mpmath-1.3.0-py3-none-any.whl',
      'sympy-1.13.3-py3-none-any.whl',
    ])
    // 边界：只认自己缓存目录里、以 .whl 结尾的普通文件
    expect(readdirSync(cacheDir).sort()).toEqual(['README.txt', 'nested-dir'])
    expect(existsSync(join(cacheDir, 'nested-dir'))).toBe(true)
  })

  it('还没缓存过（目录不存在）也算清空成功', async () => {
    apply(fakeCtx())
    const response = await call(routeAt(CACHE_PATH), 'POST', CACHE_PATH)
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ removed: [] })
  })

  it('非 POST 一律 405（清盘不能靠一个 GET 就被触发）', async () => {
    seedCache()
    apply(fakeCtx())
    const response = await call(routeAt(CACHE_PATH), 'GET', CACHE_PATH)
    expect(response.statusCode).toBe(405)
    expect(readdirSync(cacheDir)).toContain('sympy-1.13.3-py3-none-any.whl')
  })

  it('给了 names 就只清这几个（设置页按行清理），别的包不能跟着被清', async () => {
    seedCache()
    apply(fakeCtx())
    const response = await call(routeAt(CACHE_PATH), 'POST', CACHE_PATH, { names: ['sympy'] })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body).removed).toEqual(['sympy-1.13.3-py3-none-any.whl'])
    expect(readdirSync(cacheDir).sort()).toEqual(['README.txt', 'mpmath-1.3.0-py3-none-any.whl', 'nested-dir'])
  })

  it('按名字清时名字写法不一致也认（用户会写 Pillow / scikit_learn 这种）', async () => {
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(join(cacheDir, 'pillow-10.2.0-cp312-cp312-pyodide_2024_0_wasm32.whl'), 'w')
    apply(fakeCtx())
    const response = await call(routeAt(CACHE_PATH), 'POST', CACHE_PATH, { names: ['Pillow'] })
    expect(JSON.parse(response.body).removed).toEqual(['pillow-10.2.0-cp312-cp312-pyodide_2024_0_wasm32.whl'])
  })

  it('names 里混着不认识的、或本来就没缓存的，静默跳过（不是错）', async () => {
    seedCache()
    apply(fakeCtx())
    const response = await call(routeAt(CACHE_PATH), 'POST', CACHE_PATH, { names: ['definitely-not-a-package', 'scipy', 'sympy'] })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body).removed).toEqual(['sympy-1.13.3-py3-none-any.whl'])
  })

  it('按名字清也守尺度：不动非包文件与子目录', async () => {
    seedCache()
    apply(fakeCtx())
    await call(routeAt(CACHE_PATH), 'POST', CACHE_PATH, { names: ['sympy', 'mpmath'] })
    expect(readdirSync(cacheDir).sort()).toEqual(['README.txt', 'nested-dir'])
  })

  it('坏正文给 400，不是 500（清缓存也不能被一段烂 JSON 说成插件故障）', async () => {
    apply(fakeCtx())
    const response = await callRaw(routeAt(CACHE_PATH), 'POST', CACHE_PATH, '{')
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body).error).toContain('不是合法 JSON')
  })
})

describe('包清单路由', () => {
  /** lock 里挑一条**随包目录没有**的条目：只有这种才可能落到「未缓存」。 */
  function remoteOnlyEntry(): { name: string; fileName: string } {
    const lock = JSON.parse(readFileSync(join(PYODIDE_DIR, 'pyodide-lock.json'), 'utf8')) as {
      packages: Record<string, { file_name: string }>
    }
    const bundled = new Set(readdirSync(PYODIDE_DIR))
    const found = Object.values(lock.packages).find((entry) => !bundled.has(entry.file_name) && entry.file_name.endsWith('.whl'))
    if (found === undefined) throw new Error('lock 里没有「随包目录没有」的 wheel，未缓存这一路没法测')
    return { name: found.name, fileName: found.file_name }
  }

  interface Entry {
    name: string
    fileName: string
    state: string
    bytes: number | null
    depends: string[]
  }

  /** 取一次清单并解析成可以直接查的表。 */
  async function inventory(): Promise<{ cacheDir: string; pyodideVersion: string; entries: Entry[] }> {
    apply(fakeCtx())
    const response = await call(routeAt(PACKAGES_PATH), 'GET', PACKAGES_PATH)
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/json')
    return JSON.parse(response.body) as { cacheDir: string; pyodideVersion: string; entries: Entry[] }
  }

  it('三种状态各判一次：随包的算随包、缓存目录里的算已缓存、其余算未缓存', async () => {
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(join(cacheDir, 'pandas-2.2.3-cp312-cp312-pyodide_2024_0_wasm32.whl'), 'cached-bytes')
    const body = await inventory()
    expect(body.cacheDir).toBe(cacheDir)
    expect(body.pyodideVersion).toBe('0.27.7')
    const byName = new Map(body.entries.map((entry) => [entry.name, entry]))
    // 随包件会被 seedBundledPackages 硬链接进缓存目录，所以「随包」必须优先于「已缓存」判定
    expect(byName.get('sympy')!.state).toBe('bundled')
    expect(byName.get('pandas')!.state).toBe('cached')
    expect(byName.get('pandas')!.bytes).toBe('cached-bytes'.length)
    const remote = remoteOnlyEntry()
    expect(byName.get(remote.name)!.state).toBe('absent')
    expect(byName.get(remote.name)!.bytes).toBeNull()
    // 依赖闭包由客户端自己算，所以 depends 必须发出去
    expect(byName.get('matplotlib')!.depends).toContain('numpy')
  })

  it('只列有 whl / zip 产物的条目：测试包（.tar）与 Pyodide 本体都不算「可取的包」', async () => {
    const fileNames = (await inventory()).entries.map((entry) => entry.fileName)
    expect(fileNames).toContain('matplotlib-3.8.4-cp312-cp312-pyodide_2024_0_wasm32.whl')
    // cpython_module（hashlib 之类）是独立 whl，用户 import 时真的要取——保留
    expect(fileNames).toContain('hashlib-1.0.0-cp312-cp312-pyodide_2024_0_wasm32.whl')
    // `*-tests` 的产物是 .tar，装不进运行时
    expect(fileNames.some((name) => name.endsWith('.tar'))).toBe(false)
    expect(fileNames).not.toContain('pyodide.asm.wasm')
    expect(fileNames).not.toContain('python_stdlib.zip')
  })

  it('名字用 lock 的键，不是条目里的 name 字段（`pillow` 而不是 `Pillow`）', async () => {
    const names = (await inventory()).entries.map((entry) => entry.name)
    expect(names).toContain('pillow')
    expect(names).toContain('scikit-learn')
    expect(names).not.toContain('Pillow')
  })

  it('依赖引用条条都对得上目录里的名字——原来 pillow 这类客户端对不上，取 matplotlib 会漏掉它', async () => {
    const entries = (await inventory()).entries
    const names = new Set(entries.map((entry) => entry.name))
    const dangling: string[] = []
    for (const entry of entries) {
      for (const dependency of entry.depends) {
        if (!names.has(dependency)) dangling.push(`${entry.name} -> ${dependency}`)
      }
    }
    expect(dangling).toEqual([])
    // matplotlib 真的依赖 pillow：这条以前是坏的（客户端按字段名发了 `Pillow`，
    // 而清单里叫 `pillow`，闭包把它当「名字对不上」跳过），所以单独钉一句
    expect(entries.find((entry) => entry.name === 'matplotlib')!.depends).toContain('pillow')
  })

  it('缓存目录不存在时不算错：全表按「未缓存」回答', async () => {
    const states = new Set((await inventory()).entries.map((entry) => entry.state))
    expect(states.has('cached')).toBe(false)
  })

  it('清单上只放行 GET', async () => {
    apply(fakeCtx())
    expect((await call(routeAt(PACKAGES_PATH), 'POST', PACKAGES_PATH)).statusCode).toBe(405)
  })

  it('不认识的子路径 404（不把任意 URL 当包处理）', async () => {
    apply(fakeCtx())
    expect((await call(routeAt(PACKAGES_PATH), 'GET', `${PACKAGES_PATH}/nope`)).statusCode).toBe(404)
  })
})

describe('预缓存路由', () => {
  /** lock 里挑一条**随包目录没有**的条目：只有这种才会真去取。 */
  function remoteOnlyEntry(): { name: string; fileName: string } {
    const lock = JSON.parse(readFileSync(join(PYODIDE_DIR, 'pyodide-lock.json'), 'utf8')) as {
      packages: Record<string, { file_name: string }>
    }
    const bundled = new Set(readdirSync(PYODIDE_DIR))
    const found = Object.values(lock.packages).find((entry) => !bundled.has(entry.file_name) && entry.file_name.endsWith('.whl'))
    if (found === undefined) throw new Error('lock 里没有「随包目录没有」的 wheel，预缓存这一路没法测')
    return { name: found.name, fileName: found.file_name }
  }

  interface Result {
    name: string
    state: string
    downloaded: boolean
    bytes?: number
    error?: string
  }

  async function prefetch(names: string[]): Promise<Result[]> {
    apply(fakeCtx())
    const response = await call(routeAt(PACKAGES_PATH), 'POST', `${PACKAGES_PATH}/cache`, { names })
    expect(response.statusCode).toBe(200)
    return (JSON.parse(response.body) as { results: Result[] }).results
  }

  it('已经在本地的包直接跳过、不重下（随包的也算）', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(await prefetch(['sympy'])).toEqual([
      { name: 'sympy', state: 'bundled', downloaded: false, bytes: 0 },
    ])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('缓存目录里已有的包也不重下，并把本机占用一起回给界面', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(join(cacheDir, 'pandas-2.2.3-cp312-cp312-pyodide_2024_0_wasm32.whl'), 'cached-bytes')
    expect(await prefetch(['pandas'])).toEqual([
      { name: 'pandas', state: 'cached', downloaded: false, bytes: 'cached-bytes'.length },
    ])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('lock 里没有的名字当场拒，不去取', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const results = await prefetch(['definitely-not-a-package'])
    expect(results).toHaveLength(1)
    expect(results[0]!.state).toBe('unknown')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('按 sha256 校验：对不上就报错，且不留下半截文件', async () => {
    const remote = remoteOnlyEntry()
    const requested: string[] = []
    vi.stubGlobal('fetch', (url: string) => {
      requested.push(url)
      // 长度对不上 lock 里的 sha256——正是「下载到一半 / 拿到错的东西」那类
      return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) })
    })
    const results = await prefetch([remote.name])
    expect(results[0]!.state).toBe('absent')
    expect(results[0]!.error).toContain('校验不过')
    // 回源的地址由 lock 的版本决定，不是写死的字面量
    expect(requested[0]).toBe(`https://cdn.jsdelivr.net/pyodide/v0.27.7/full/${remote.fileName}`)
    expect(existsSync(cacheDir) === false || readdirSync(cacheDir).length === 0).toBe(true)
  })

  it('失败即停：第一个取不到就不再往下取（同一个系统性问题不必重复 N 遍）', async () => {
    const remote = remoteOnlyEntry()
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    const results = await prefetch([remote.name, 'pandas'])
    expect(results).toHaveLength(1)
    expect(results[0]!.state).toBe('absent')
    expect(results[0]!.error).toContain('offline')
    expect(vi.mocked(console.error).mock.calls.flat().join(' ')).toContain('预缓存')
  })

  it('可下载目录里每条都带着 lock 的 sha256——缺一个字段，预缓存就会「每次都失败」且看不出为什么', () => {
    // 这一条是补的：曾经 CATALOG 映射时漏了 sha256，于是下载校验的期望值恒为 undefined、
    // 每次预缓存都必然「校验不过」，报错只说「期望 undefined」。而当时唯一的校验用例
    // 只验了「对不上要报错」——它当然也过，因为 undefined 与任何摘要都对不上。
    const lock = JSON.parse(readFileSync(join(PYODIDE_DIR, 'pyodide-lock.json'), 'utf8')) as {
      packages: Record<string, { file_name: string; sha256: string }>
    }
    const digestOf = new Map(Object.values(lock.packages).map((entry) => [entry.file_name, entry.sha256]))
    // 数量对上：目录就是 lock 里有 whl / zip 产物的那些（285 条，别写死数字）
    const downloadable = Object.values(lock.packages).filter((entry) => /\.(whl|zip)$/u.test(entry.file_name))
    expect(CATALOG).toHaveLength(downloadable.length)
    const broken = CATALOG.filter((entry) => entry.sha256 !== digestOf.get(entry.fileName))
    expect(broken.map((entry) => entry.name)).toEqual([])
  })

  it('names 不是字符串数组（含空）给 400', async () => {
    apply(fakeCtx())
    for (const body of [{}, { names: [] }, { names: [42] }, { names: [''] }]) {
      const response = await call(routeAt(PACKAGES_PATH), 'POST', `${PACKAGES_PATH}/cache`, body)
      expect(response.statusCode).toBe(400)
    }
  })

  it('正文不是合法 JSON 给 400，不是 500——这是请求的错，不该报成插件故障', async () => {
    const logged = vi.mocked(console.error)
    logged.mockClear()
    apply(fakeCtx())
    const response = await callRaw(routeAt(PACKAGES_PATH), 'POST', `${PACKAGES_PATH}/cache`, '{')
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body).error).toContain('不是合法 JSON')
    // 客户端的错不该往日志里灌堆栈（真故障才需要）
    expect(logged).not.toHaveBeenCalled()
  })

  it('正文超过 64KB 给 400（别让一个请求把内存占满）', async () => {
    apply(fakeCtx())
    const huge = `{"names":["${'x'.repeat(70 * 1024)}"]}`
    const response = await callRaw(routeAt(PACKAGES_PATH), 'POST', `${PACKAGES_PATH}/cache`, huge)
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body).error).toContain('超过')
  })

  it('非 POST 一律 405（预缓存要落盘，不能被一个 GET 触发）', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    apply(fakeCtx())
    expect((await call(routeAt(PACKAGES_PATH), 'GET', `${PACKAGES_PATH}/cache`)).statusCode).toBe(405)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('本机环境探测路由', () => {
  interface Plan {
    platform: string
    arch: string
    path: string
    checks: Array<{ id: string; tool: string; command: string; status?: string }>
  }

  it('GET 给计划：平台 / PATH / 逐项要跑的命令，且**不跑任何命令**', async () => {
    apply(fakeCtx())
    const response = await call(routeAt(ENV_PATH), 'GET', ENV_PATH)
    expect(response.statusCode).toBe(200)
    const plan = JSON.parse(response.body) as Plan
    expect(plan.platform).toBe(process.platform)
    expect(plan.arch).toBe(process.arch)
    // 补过的 PATH 里得有系统目录，否则「明明装了却报没装」
    expect(plan.path.split(':')).toContain('/usr/bin')
    // 计划里不带结果——带了就说明它偷偷跑了命令，首屏会被 manim 的十几秒吊住
    expect(plan.checks.every((check) => check.status === undefined)).toBe(true)
    expect(plan.checks.some((check) => check.tool === 'manim')).toBe(true)
    expect(plan.checks.some((check) => check.command.includes('import manim'))).toBe(true)
    expect(plan.checks.some((check) => check.tool === 'ffmpeg')).toBe(true)
  })

  it('专项探测：找得到的命令真跑一次并拿到版本行', async () => {
    apply(fakeCtx())
    const response = await call(routeAt(ENV_PATH), 'GET', `${ENV_PATH}/python3`)
    expect(response.statusCode).toBe(200)
    const result = JSON.parse(response.body) as { id: string; status: string; path: string; version: string }
    expect(result.id).toBe('python3')
    // 跑这一份测试的机器上必然有 python3
    expect(result.status).toBe('ok')
    expect(result.path.startsWith('/')).toBe(true)
    expect(result.version).toMatch(/^Python \d/)
  })

  it('不认识的探测项 404', async () => {
    apply(fakeCtx())
    expect((await call(routeAt(ENV_PATH), 'GET', `${ENV_PATH}/nope`)).statusCode).toBe(404)
  })

  it('非 GET 一律 405', async () => {
    apply(fakeCtx())
    expect((await call(routeAt(ENV_PATH), 'POST', ENV_PATH)).statusCode).toBe(405)
  })
})

describe('pythonBesideExecutable（「manim 库」跟着命令走）', () => {
  let root = ''

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'manim-beside-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('venv 布局：软链入口解到 venv 里，解释器取同层 bin/python3', () => {
    mkdirSync(join(root, 'venv', 'bin'), { recursive: true })
    writeFileSync(join(root, 'venv', 'bin', 'manim'), '#!/bin/sh\n')
    writeFileSync(join(root, 'venv', 'bin', 'python3'), '#!/bin/sh\n')
    chmodSync(join(root, 'venv', 'bin', 'manim'), 0o755)
    chmodSync(join(root, 'venv', 'bin', 'python3'), 0o755)
    mkdirSync(join(root, 'link'))
    symlinkSync(join(root, 'venv', 'bin', 'manim'), join(root, 'link', 'manim'))
    // ~/.local/bin/manim 这类入口正是这种软链——不解开就找不到 venv。
    // macOS 的 /var 是 /private/var 的软链，两边都先 realpath 再比，别让系统的链搅进来。
    expect(pythonBesideExecutable(join(root, 'link', 'manim'))).toBe(realpathSync(join(root, 'venv', 'bin', 'python3')))
  })

  it('非 venv 布局（裸脚本）：找不到同层解释器回 null，退回原兜底', () => {
    mkdirSync(join(root, 'usr', 'bin'), { recursive: true })
    writeFileSync(join(root, 'usr', 'bin', 'manim'), '#!/bin/sh\n')
    chmodSync(join(root, 'usr', 'bin', 'manim'), 0o755)
    expect(pythonBesideExecutable(join(root, 'usr', 'bin', 'manim'))).toBeNull()
  })

  it('文件不存在：不抛，回 null', () => {
    expect(pythonBesideExecutable(join(root, 'nope', 'manim'))).toBeNull()
  })
})

describe('在 PATH 里找命令', () => {
  it('找不到回 null（缺工具是这条功能的正常结果，不是错）', () => {
    expect(resolveExecutable('definitely-not-a-real-tool-9f3a')).toBeNull()
  })

  it('找得到回绝对路径，并且补过的系统目录真的生效', () => {
    // 只留一个空 PATH：此时还能找到，说明 /usr/bin 这类兜底目录起了作用
    const saved = process.env.PATH
    process.env.PATH = ''
    try {
      expect(resolveExecutable('python3')?.startsWith('/')).toBe(true)
    } finally {
      process.env.PATH = saved
    }
  })
})

/**
 * 真下载那一格：离线造不出「sha256 对得上」的字节（那等于求 sha256 的原像），
 * 所以放进联网组——`pnpm test:net`（`MANIM_NET=1`）才跑。挑最小的那几个包（几 KB），
 * 且缓存目录是每个用例自己的临时目录，不碰用户真正的缓存。
 */
const NET = process.env.MANIM_NET === '1'

describe.skipIf(!NET)('预缓存真取一个包（联网，MANIM_NET=1 才跑）', () => {
  /** 几 KB 的纯 Python 包：lock 里的 `file_size` 不全，所以按名字点。 */
  const SMALL = ['affine', 'six', 'cycler', 'pyparsing']

  interface Downloaded {
    name: string
    state: string
    downloaded: boolean
    bytes?: number
    error?: string
  }

  async function prefetch(names: string[]): Promise<Downloaded[]> {
    apply(fakeCtx())
    const response = await call(routeAt(PACKAGES_PATH), 'POST', `${PACKAGES_PATH}/cache`, { names })
    expect(response.statusCode).toBe(200)
    return (JSON.parse(response.body) as { results: Downloaded[] }).results
  }

  it('取回 → 校验过 → 原子落盘 → 再取不再下', async () => {
    const target = CATALOG.find((entry) => SMALL.includes(entry.name))
    expect(target, `这几个小包都不在 lock 里：${SMALL.join('、')}`).toBeDefined()
    const packageEntry = target!

    const first = await prefetch([packageEntry.name])
    expect(first[0]!.error).toBeUndefined()
    expect(first[0]!.state).toBe('cached')
    expect(first[0]!.downloaded).toBe(true)
    expect(first[0]!.bytes).toBeGreaterThan(0)

    // 落地的字节要和 lock 的 sha256 对得上（中途截断 / 拿到别的东西都过不了这一关）
    const landed = join(cacheDir, packageEntry.fileName)
    expect(existsSync(landed)).toBe(true)
    expect(createHash('sha256').update(readFileSync(landed)).digest('hex')).toBe(packageEntry.sha256)
    // 临时文件不留
    expect(existsSync(`${landed}.part`)).toBe(false)

    const second = await prefetch([packageEntry.name])
    expect(second[0]!.downloaded).toBe(false)
    expect(second[0]!.bytes).toBe(first[0]!.bytes)
  })
})
