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
 *  - 语料路由 + 清包缓存路由（见下方两组）。
 *
 * `core.js` 被替身接走：工具执行里的 `runPython` 不真起 Pyodide，`setPyodideLoader` 只记录
 * （否则这一份会变成几秒级的集成测试）。资源路由用的是真的 node:stream，文件也是真的。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Writable } from 'node:stream'
import { apply } from './index.js'
// 上面那份替身里的函数要在测试里直接驱动（断言被调用、改返回值）——vi.mock 会被提升，顺序无所谓
import { runPython, setPyodideLoader } from '../../core.js'

vi.mock('../../core.js', async (importOriginal) => {
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

const CORPUS_PATH = '/dsh-plugins/manim-renderer/corpus'
const CACHE_PATH = '/dsh-plugins/manim-renderer/cache'
const KATEX_PATH = '/dsh-plugins/manim-renderer/katex'
const PYODIDE_PATH = '/dsh-plugins/manim-renderer/pyodide'

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

/** 假响应：够这两条路由用（只看 statusCode / setHeader / end）；statusCode 默认 200，同真实 Node。 */
function call(route: Route, method: string, url: string) {
  const response = {
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
  return route.handler({ method, url }, response).then(() => response)
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
  cacheDir = join(homeRoot, 'cache', 'manim-renderer', 'pyodide')
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
  it('注册了工具 / 技能 / 常驻指引，以及四条路由', () => {
    apply(fakeCtx())
    expect(captured.tools).toHaveLength(1)
    expect(captured.skills).toHaveLength(1)
    expect(captured.sections).toHaveLength(1)
    expect(captured.routes.map((route) => route.path)).toEqual(
      expect.arrayContaining([KATEX_PATH, PYODIDE_PATH, CORPUS_PATH, CACHE_PATH]),
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
        join(homeRoot, 'custom-home', 'cache', 'manim-renderer', 'pyodide'),
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
    expect(skill.name).toBe('manim-renderer')
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
    expect(section.name).toBe('manim-renderer:guide')
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
})
