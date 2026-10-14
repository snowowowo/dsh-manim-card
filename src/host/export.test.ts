/**
 * 导出路由（host/export.js 的 HTTP 面）的行为边界。
 *
 * 导出本事的逐层测试（场景识别 / 就绪门 / 假 manim 全链路 / 定位）已随代码下沉核心包
 * （`manim-live` 的 src/export/local.test.ts）；这里只钉本插件这一层的接线：
 *  - GET /ready 回就绪结论（LaTeX 缺席不影响 ready、缺必要条件列出来）；
 *  - POST 空源码回业务失败（200 的 ok:false，不是 5xx）、坏正文 400、不认识的方法 405；
 *  - POST /export/reveal 越界回 ok:false（业务拒绝，不是 5xx）。
 *
 * `probeCheck` 被替身接走（就绪门不依赖这台机器装没装东西）；真 manim 的全链路验收
 * 在核心包的 `MANIM_EXPORT=1` 档。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportRoute, invalidateReadiness } from './export.js'

vi.mock('./environment.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    probeCheck: vi.fn(),
  }
})

// 实例在模块加载时就算好了导出目录：把 homedir 指到一次性临时目录，绝不能指向真实「下载」。
// 临时目录在 mock 工厂里现建（工厂先于 import 运行，外面的 const 拿到时会撞上 TDZ）。
vi.mock('node:os', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const { mkdtempSync } = await import('node:fs')
  const home = mkdtempSync(`${(actual.tmpdir as () => string)()}/manim-export-home-`)
  return {
    ...actual,
    homedir: () => home,
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

beforeEach(() => {
  invalidateReadiness()
  vi.mocked(probeCheck).mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

/** 假响应 / 假请求（异步可迭代，走 readBody 的真路径）。 */
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

const EXPORT_URL = '/dsh-plugins/manim-card/export'

describe('HTTP 面', () => {
  it('GET /ready：回就绪结论（LaTeX 缺席不影响 ready）', async () => {
    probeAs(READY)
    const response = await call('GET', `${EXPORT_URL}/ready`)
    expect(response.statusCode).toBe(200)
    const value = JSON.parse(response.body) as { ready: boolean; missing: unknown[] }
    expect(value.ready).toBe(true)
    expect(value.missing).toEqual([])
  })

  it('GET /ready：缺必要条件时 ready=false 并列缺什么', async () => {
    probeAs({ ...READY, python3: { status: 'missing', detail: 'PATH 里找不到 python3' } })
    const response = await call('GET', `${EXPORT_URL}/ready`)
    const value = JSON.parse(response.body) as { ready: boolean; missing: Array<{ id: string }> }
    expect(value.ready).toBe(false)
    expect(value.missing.map((item) => item.id)).toEqual(['python3'])
  })

  it('POST：空源码回业务失败（200 的 ok:false，不是 5xx）', async () => {
    probeAs(READY)
    const response = await call('POST', EXPORT_URL, { python: '' })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toMatchObject({ ok: false, reason: 'input' })
  })

  it('POST 坏正文 400', async () => {
    const response = await call('POST', EXPORT_URL, undefined)
    // body undefined 时不发任何字节 → JSON.parse('') 抛 → 400
    expect(response.statusCode).toBe(400)
  })

  it('不认识的方法 405', async () => {
    expect((await call('DELETE', EXPORT_URL)).statusCode).toBe(405)
  })

  it('POST /export/reveal 越界回 ok:false（200 的业务拒绝，不是 5xx）', async () => {
    const response = await call('POST', `${EXPORT_URL}/reveal`, { path: '/etc/hosts' })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toMatchObject({ ok: false })
  })
})
