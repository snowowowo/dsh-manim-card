/**
 * 导出视频（host/export.js）的行为边界。
 *
 * 为什么值得测：导出是插件里唯一**真刀真枪调本机命令**的路径，搞错的表现都很伤——
 * 环境没备齐就放行（用户点了按钮等半天换来一声报错）、渲染失败被吞成「没有产出」、
 * mp4 拷进不知道哪儿去了。所以这里把每一层都钉住：
 *  - 场景识别：完整文件认类名、只写 construct 体的包上外壳（与工具侧口径一致）；
 *  - 就绪门：必要条件没备齐直接回「缺什么」，**不许**走到渲染那一步；
 *  - 真导出：假 manim（一个往 media 目录写 mp4 的脚本）走通全链路——源码落盘、mp4 拷进
 *    「下载」（homedir 已替身到临时目录）、工作目录删干净；
 *  - 渲染失败：非零退出要把 manim 的报错带回来，不能只说「失败」两个字；
 *  - HTTP 面：GET /ready 秒回就绪结论、POST 真导出、坏正文 400、不认识的动作 405。
 *
 * `probeCheck` 被替身接走（就绪门不依赖这台机器装没装东西）；真 manim 的全链路验收
 * 不在单元测试里——那是 `MANIM_EXPORT=1` 的联网/本机档（见文件末尾）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import {
  buildRenderArgs,
  exportRoute,
  exportVideo,
  invalidateReadiness,
  revealExportedFile,
  sceneClassName,
  wrapConstructBody,
} from './export.js'

// probeCheck 是就绪门的唯一入口，替身它 = 测试不依赖这台机器装了什么；
// resolveExecutable 保留真身（exportVideo 在 ready 之后还要靠它找假 manim）。
vi.mock('./environment.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    probeCheck: vi.fn(),
  }
})

// homedir 替身到临时目录：导出会往「下载」里拷文件，绝不能碰用户真正的 Downloads。
const FAKE_HOME = mkdtempSync(join(tmpdir(), 'manim-export-home-'))
vi.mock('node:os', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    homedir: () => FAKE_HOME,
  }
})

import { probeCheck } from './environment.js'

function probeAs(values: Record<string, { status: string; version?: string; detail?: string }>) {
  vi.mocked(probeCheck).mockImplementation(async (id: string) => {
    const value = values[id]
    if (value === undefined) throw new Error(`测试没给 ${id} 的探测结果`)
    return {
      id,
      status: value.status as 'ok' | 'missing' | 'error',
      path: '/fake/' + id,
      version: value.version ?? '',
      detail: value.detail ?? '',
    }
  })
}

const READY = {
  python3: { status: 'ok', version: 'Python 3.14' },
  manim: { status: 'ok', version: 'Manim Community v0.22.0' },
  manimModule: { status: 'ok', version: '0.22.0' },
  ffmpeg: { status: 'ok', version: 'ffmpeg version 9.0' },
  latex: { status: 'missing', detail: 'PATH 里找不到 latex' },
  dvisvgm: { status: 'missing', detail: 'PATH 里找不到 dvisvgm' },
}

// 场景里必须有 play：manim 对没有动画的场景只存 PNG、不出 mp4（这不是 bug，是它的规则——
// 导出模块对这种情况回「没有产出视频文件」也是对的）。
const FULL_FILE = ['from manim import *', '', 'class Demo(Scene):', '    def construct(self):', '        self.play(Write(Circle()))', ''].join('\n')

beforeEach(() => {
  invalidateReadiness()
  vi.mocked(probeCheck).mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('场景代码的处理', () => {
  it('完整文件：认出 Scene 子类的类名', () => {
    expect(sceneClassName(FULL_FILE)).toBe('Demo')
  })

  it('Scene 的子类（ThreeDScene 等）也算场景', () => {
    expect(sceneClassName('class T(ThreeDScene):\n    def construct(self):\n        pass\n')).toBe('T')
  })

  it('点路径基类（x.Scene）也算场景；非 Scene 类不认', () => {
    expect(sceneClassName('class T(manim.Scene):\n    def construct(self):\n        pass\n')).toBe('T')
    expect(sceneClassName('class Helper(ValueTracker):\n    pass\n')).toBeNull()
  })

  it('只写 construct 体：认不出类名，交给外壳去包', () => {
    expect(sceneClassName('self.add(Circle())\nself.wait(1)\n')).toBeNull()
  })

  it('外壳：import * 在顶、语句缩进四格、类名固定（导出走这条的产物与工具侧口径一致）', () => {
    const wrapped = wrapConstructBody('self.add(Circle())\n\nself.wait(1)\n')
    expect(wrapped.startsWith('from manim import *\n')).toBe(true)
    expect(wrapped).toContain('class ManimExportScene(Scene):')
    expect(wrapped).toContain('    def construct(self):')
    expect(wrapped).toContain('        self.add(Circle())')
    // 空行不缩进（缩了 Python 也不报错，但生成的文件不该是脏的）
    expect(wrapped).toContain('\n\n')
  })

  it('命令行组装：质量档、media 目录、源文件、场景名各就各位', () => {
    expect(buildRenderArgs('/w/scene.py', 'Demo', 'h', '/w/media')).toEqual([
      '-qh', '--media_dir', '/w/media', '/w/scene.py', 'Demo',
    ])
  })
})

describe('就绪门', () => {
  it('必要条件没备齐：回 environment 与缺什么，且**不碰渲染**', async () => {
    probeAs({ ...READY, ffmpeg: { status: 'missing', detail: 'PATH 里找不到 ffmpeg' }, manimModule: { status: 'missing', detail: "ModuleNotFoundError: No module named 'manim'" } })
    const result = await exportVideo({ python: FULL_FILE })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('environment')
    expect(result.missing?.map((item) => item.id).sort()).toEqual(['ffmpeg', 'manimModule'])
  })

  it('LaTeX / dvisvgm 缺席**不算**必要条件：缺的名单里不许出现它们', async () => {
    probeAs({ ...READY, latex: { status: 'missing' }, dvisvgm: { status: 'missing' } })
    // PATH 清空：ready 之后解析 manim 必然失败（替身 HOME 下没有 .local/bin），导出停在 environment——
    // 关键是缺的名单里只有 manim，没有 latex / dvisvgm
    const savedPath = process.env.PATH
    process.env.PATH = ''
    try {
      const result = await exportVideo({ python: FULL_FILE })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('environment')
      expect(result.missing?.map((item) => item.id)).toEqual(['manim'])
    } finally {
      process.env.PATH = savedPath
    }
  })

  it('结论带 TTL 缓存：TTL 内不重复探测（几十张卡各问一遍不能各跑一遍 manim --version）', async () => {
    probeAs(READY)
    const { exportReadiness } = await import('./export.js')
    await exportReadiness()
    await exportReadiness()
    expect(probeCheck).toHaveBeenCalledTimes(6) // 4 必要 + 2 可选，各一次
  })

  it('空源码当场拒，连探测都不跑', async () => {
    const result = await exportVideo({ python: '   ' })
    expect(result).toMatchObject({ ok: false, reason: 'input' })
    expect(probeCheck).not.toHaveBeenCalled()
  })
})

describe('真导出（假 manim 脚本）', () => {
  let work = ''
  let fakeManim = ''

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'manim-export-case-'))
    mkdirSync(join(work, 'bin'))
    fakeManim = join(work, 'bin', 'manim')
  })

  afterEach(() => {
    rmSync(work, { recursive: true, force: true })
  })

  /** 假 manim：把参数里的 media 目录找出来，往里写一个 mp4（或按 FAIL 的指示退出非零）。 */
  function installFakeManim(behavior: 'ok' | 'fail' | 'silent' = 'ok'): void {
    const script = behavior === 'fail'
      ? [
          '#!/usr/bin/env node',
          'process.stderr.write("Traceback (most recent call last):\\n")',
          'process.stderr.write("ValueError: too many circles\\n")',
          'process.exit(1)',
        ]
      : behavior === 'silent'
        ? [
            '#!/usr/bin/env node',
            'const args = process.argv.slice(2)',
            'const mdir = args[args.indexOf("--media_dir") + 1]',
            'require("node:fs").mkdirSync(mdir + "/videos/scene/1080p60", { recursive: true })',
          ]
        : [
            '#!/usr/bin/env node',
            'const args = process.argv.slice(2)',
            'const mdir = args[args.indexOf("--media_dir") + 1]',
            'require("node:fs").mkdirSync(mdir + "/videos/scene/1080p60", { recursive: true })',
            'require("node:fs").writeFileSync(mdir + "/videos/scene/1080p60/Demo.mp4", "mp4-bytes")',
          ]
    writeFileSync(fakeManim, script.join('\n') + '\n')
    chmodSync(fakeManim, 0o755)
  }

  it('全链路：源码落盘 → 假 manim 渲染 → mp4 拷进「下载」→ 工作目录删干净', async () => {
    installFakeManim('ok')
    probeAs(READY)
    // 假 manim 放上 PATH 的第一位：resolveExecutable（真身）按序找，第一个命中就是它，
    // 不会摸到这台机器上真装的那份
    const savedPath = process.env.PATH
    process.env.PATH = `${join(work, 'bin')}:${savedPath}`
    try {
      const result = await exportVideo({ python: FULL_FILE })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.file.startsWith(join(FAKE_HOME, 'Downloads'))).toBe(true)
      expect(basename(result.file)).toMatch(/^manim-Demo-\d{8}T\d{6}\.mp4$/u)
      expect(result.quality).toBe('h')
      expect(existsSync(result.file)).toBe(true)
      // 工作目录清干净：os.tmpdir() 下不该再留导出过程目录（本用例自己的 case 目录与替身 HOME 除外）
      const leftovers = readdirSync(tmpdir()).filter(
        (name) => /^manim-export-(?!case-|home-)/u.test(name),
      )
      expect(leftovers).toEqual([])
    } finally {
      process.env.PATH = savedPath
    }
  })

  it('渲染失败（非零退出）：把 manim 的报错带回来', async () => {
    installFakeManim('fail')
    probeAs(READY)
    const savedPath = process.env.PATH
    process.env.PATH = `${join(work, 'bin')}:${savedPath}`
    try {
      const result = await exportVideo({ python: FULL_FILE })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('render')
      expect(result.error).toContain('ValueError: too many circles')
    } finally {
      process.env.PATH = savedPath
    }
  })

  it('跑完但没有 mp4：不算成功，也不许假装成功', async () => {
    installFakeManim('silent')
    probeAs(READY)
    const savedPath = process.env.PATH
    process.env.PATH = `${join(work, 'bin')}:${savedPath}`
    try {
      const result = await exportVideo({ python: FULL_FILE })
      expect(result).toMatchObject({ ok: false, reason: 'render' })
      if (result.ok) return
      expect(result.error).toContain('没有产出视频')
    } finally {
      process.env.PATH = savedPath
    }
  })
})

describe('HTTP 面', () => {
  /** 与 routes.test.ts 同款的假响应 / 假请求（异步可迭代，走 readBody 的真路径）。 */
  function responseStub() {
    return {
      statusCode: 200,
      body: '',
      setHeader() {},
      end(this: { body: string }, body?: string) {
        this.body = body ?? ''
      },
    }
  }
  async function call(method: string, url: string, body?: unknown) {
    const response = responseStub()
    const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body), 'utf8')]
    const request = {
      method,
      url,
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) yield chunk
      },
    }
    const route = exportRoute()
    await route.handler(request as never, response as never)
    return response
  }

  it('GET /ready：回就绪结论（LaTeX 缺席不影响 ready）', async () => {
    probeAs(READY)
    const response = await call('GET', '/dsh-plugins/manim-renderer/export/ready')
    expect(response.statusCode).toBe(200)
    const value = JSON.parse(response.body) as { ready: boolean; missing: unknown[] }
    expect(value.ready).toBe(true)
    expect(value.missing).toEqual([])
  })

  it('GET /ready：缺必要条件时 ready=false 并列缺什么', async () => {
    probeAs({ ...READY, python3: { status: 'missing', detail: 'PATH 里找不到 python3' } })
    const response = await call('GET', '/dsh-plugins/manim-renderer/export/ready')
    const value = JSON.parse(response.body) as { ready: boolean; missing: Array<{ id: string }> }
    expect(value.ready).toBe(false)
    expect(value.missing.map((item) => item.id)).toEqual(['python3'])
  })

  it('POST：空源码回业务失败（200 的 ok:false，不是 5xx）', async () => {
    probeAs(READY)
    const response = await call('POST', '/dsh-plugins/manim-renderer/export', { python: '' })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toMatchObject({ ok: false, reason: 'input' })
  })

  it('POST 坏正文 400', async () => {
    const response = await call('POST', '/dsh-plugins/manim-renderer/export', undefined)
    // body undefined 时不发任何字节 → JSON.parse('') 抛 → 400
    expect(response.statusCode).toBe(400)
  })

  it('不认识的方法 405', async () => {
    expect((await call('DELETE', '/dsh-plugins/manim-renderer/export')).statusCode).toBe(405)
  })
})

describe('在文件浏览器里定位导出文件', () => {
  let downloads = ''
  /** 假 runner：只记下被调用的命令，绝不真弹 Finder。 */
  function spyRunner() {
    const calls: Array<{ file: string; args: string[] }> = []
    const run = (file: string, args: string[]) => {
      calls.push({ file, args })
      return Promise.resolve({ error: null, stdout: '', stderr: '' })
    }
    return { calls, run }
  }

  beforeEach(() => {
    downloads = join(FAKE_HOME, 'Downloads')
    mkdirSync(downloads, { recursive: true })
  })

  it('导出目录里的文件：按平台调对命令（macOS 是 open -R 选中它）', async () => {
    const file = join(downloads, 'manim-Demo-20261010T100000.mp4')
    writeFileSync(file, 'mp4-bytes')
    const { calls, run } = spyRunner()
    const result = await revealExportedFile(file, { run })
    expect(result.ok).toBe(true)
    expect(calls).toHaveLength(1)
    if (process.platform === 'darwin') {
      expect(calls[0]?.file).toBe('open')
      expect(calls[0]?.args[0]).toBe('-R')
    }
  })

  it('导出目录之外一律拒绝：不能拿页面上的路径当「替你操作系统」的通路', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'manim-outside-'))
    const file = join(outside, 'secret.mp4')
    writeFileSync(file, 'x')
    const { calls, run } = spyRunner()
    try {
      const result = await revealExportedFile(file, { run })
      expect(result.ok).toBe(false)
      expect(result.error).toContain('只能打开导出目录里的文件')
      expect(calls).toEqual([]) // 拒绝了就一条命令都不许跑
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('文件已经不在了：如实回，不抛', async () => {
    const { run } = spyRunner()
    const result = await revealExportedFile(join(downloads, 'gone.mp4'), { run })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('文件不在了')
  })

  it('空路径当场拒', async () => {
    const { run } = spyRunner()
    expect(await revealExportedFile('', { run })).toMatchObject({ ok: false })
  })

  it('HTTP 面：POST /export/reveal 越界回 ok:false（200 的业务拒绝，不是 5xx）', async () => {
    const route = exportRoute()
    const response = { statusCode: 200, body: '', setHeader() {}, end(body?: string) { this.body = body ?? '' } }
    const chunk = Buffer.from(JSON.stringify({ path: '/etc/hosts' }), 'utf8')
    const request = {
      method: 'POST',
      url: '/dsh-plugins/manim-renderer/export/reveal',
      async *[Symbol.asyncIterator]() {
        yield chunk
      },
    }
    await route.handler(request as never, response as never)
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toMatchObject({ ok: false })
  })
})

/**
 * 真 manim 的全链路（要用**真装的** manim 渲染一段、真的往临时 HOME 的「下载」里落一个 mp4）：
 * `MANIM_EXPORT=1 pnpm test` 才跑。单元档已用假 manim 钉住了每一层的行为，这一档是端到端的存照。
 */
const REAL = process.env.MANIM_EXPORT === '1' && process.platform !== 'win32'

describe.skipIf(!REAL)('真 manim 导出（MANIM_EXPORT=1 才跑）', () => {
  it('渲染一段简单动画并落到临时 HOME 的「下载」', async () => {
    probeAs(READY) // 就绪门照常生效；probeCheck 是替身，但 manim 本身是真的
    invalidateReadiness()
    // 替身 HOME 把搜索路径里的 ~/.local/bin 也换掉了，真机档要自己把它接回来
    // （manim 就软链在那儿；用 process.env.HOME，那个没被替身）
    const realLocalBin = join(process.env.HOME ?? '', '.local', 'bin')
    const savedPath = process.env.PATH
    process.env.PATH = `${realLocalBin}:${savedPath}`
    try {
      const result = await exportVideo({ python: FULL_FILE, quality: 'l' })
      console.info('[manim-export] result:', result)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.file.startsWith(join(FAKE_HOME, 'Downloads'))).toBe(true)
        expect(existsSync(result.file)).toBe(true)
        rmSync(result.file, { force: true })
      }
    } finally {
      process.env.PATH = savedPath
    }
  }, 120_000)
})
