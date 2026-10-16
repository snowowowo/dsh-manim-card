/**
 * 导出接线：这是本插件与**浏览器逐帧导出**的唯一接口。
 *
 * 要钉住的三件事：
 *  - 接入者按 **id** 找，不按下标——核心包把自带那个排在最前是它的实现细节；
 *  - `RenderController` 三个成员**原样转发**给画布，不自己实现一份（`collect` 必须在**真画布**上跑，
 *    它会把代码真跑一遍来收集时间轴）；
 *  - 结论的三种失败码分得开：浏览器没能力（`unsupported`）、编码失败（`failed`）、接入者没接上
 *    （`broken`）。措辞在 `../i18n`，所以这里只断言码与原料，不抄一遍中文。
 *
 * `manim-live` 整块被替身接走：本文件测的是「接线」，不是编码；真编码（WebCodecs / MediaRecorder）
 * 是上游 manim-web 的事，在核心包那侧的真机台子里跑。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('manim-live', () => ({
  browserVideo: { id: 'browser-video' },
}))

const exporters: unknown[] = []
vi.mock('./renderer', () => ({
  manimRenderer: () => ({ exporters }),
}))

import type { Exporter, Surface } from 'manim-live'
import { browserExporter, controllerOf, exportVideoInBrowser } from './export'

/** 假接入者：只记调用、按预设回执，不做任何编码。 */
function stubExporter(overrides: Partial<Exporter> = {}): Exporter & { calls: number } {
  const stub = {
    id: 'browser-video',
    label: '浏览器逐帧导出',
    calls: 0,
    probe: vi.fn(() => Promise.resolve({ ready: true })),
    run: vi.fn(() => Promise.resolve({ ok: true, kind: 'blob', blob: new Blob(['x']), name: 'manim.mp4', mime: 'video/mp4' })),
    ...overrides,
  } as unknown as Exporter & { calls: number }
  return stub
}

/** 假画布：三个成员各记一笔，用来验「原样转发」。 */
function stubSurface(): Surface & { seen: string[] } {
  const seen: string[] = []
  return {
    seen,
    canvas: () => { seen.push('canvas'); return null },
    isRendered: () => { seen.push('isRendered'); return true },
    collect: (python: string) => { seen.push(`collect:${python}`); return Promise.resolve({ timeline: python }) },
  } as unknown as Surface & { seen: string[] }
}

beforeEach(() => {
  exporters.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('找导出接入者', () => {
  it('按 id 找，不看它排第几个', () => {
    const other = { id: 'local-manim' } as unknown as Exporter
    const wanted = stubExporter()
    exporters.push(other, wanted)
    expect(browserExporter()).toBe(wanted)
  })

  it('一个都没有时给 null（不抛，交给调用方出文案）', () => {
    expect(browserExporter()).toBeNull()
  })
})

describe('画布 → RenderController', () => {
  it('三个成员原样转发（不自己造一份实现）', async () => {
    const surface = stubSurface()
    const controller = controllerOf(surface)
    expect(controller.canvas()).toBeNull()
    expect(controller.isRendered()).toBe(true)
    await controller.collect('print(1)')
    // collect 必定落在**真画布**上：它把那块画布上的场景交出去给导出器逐帧出图。
    expect(surface.seen).toEqual(['canvas', 'isRendered', 'collect:print(1)'])
  })
})

describe('跑一次导出', () => {
  it('成功：回 Blob 与接入者算出来的文件名（不写死扩展名）', async () => {
    exporters.push(stubExporter())
    const outcome = await exportVideoInBrowser('print(1)', stubSurface(), () => {})
    expect(outcome).toEqual({ ok: true, blob: expect.any(Blob), name: 'manim.mp4' })
  })

  it('浏览器没能力：把缺项的可读名原样带回（不自造名字）', async () => {
    exporters.push(stubExporter({
      probe: vi.fn(() => Promise.resolve({ ready: false, missing: [{ id: 'video-encoder', label: 'WebCodecs 或 MediaRecorder' }] })),
    }))
    const outcome = await exportVideoInBrowser('print(1)', stubSurface(), () => {})
    expect(outcome).toEqual({ ok: false, code: 'unsupported', missing: ['WebCodecs 或 MediaRecorder'] })
  })

  it('没能力时压根不去 run（探测是门，不是提示）', async () => {
    const run = vi.fn()
    exporters.push(stubExporter({ probe: vi.fn(() => Promise.resolve({ ready: false })), run }))
    await exportVideoInBrowser('print(1)', stubSurface(), () => {})
    expect(run).not.toHaveBeenCalled()
  })

  it('编码失败：原样带核心包给的原因', async () => {
    exporters.push(stubExporter({ run: vi.fn(() => Promise.resolve({ ok: false, reason: 'error', error: '逐帧编码炸了' })) }))
    const outcome = await exportVideoInBrowser('print(1)', stubSurface(), () => {})
    expect(outcome).toEqual({ ok: false, code: 'failed', detail: '逐帧编码炸了' })
  })

  it('run 抛错：也当成编码失败，别把异常漏给界面', async () => {
    exporters.push(stubExporter({ run: vi.fn(() => Promise.reject(new Error('炸了'))) }))
    const outcome = await exportVideoInBrowser('print(1)', stubSurface(), () => {})
    expect(outcome).toEqual({ ok: false, code: 'failed', detail: '炸了' })
  })

  it('回的不是 blob：算接入者接错了（本机那条路才回 file）', async () => {
    exporters.push(stubExporter({ run: vi.fn(() => Promise.resolve({ ok: true, kind: 'file', path: '/tmp/a.mp4' })) }))
    const outcome = await exportVideoInBrowser('print(1)', stubSurface(), () => {})
    expect(outcome).toEqual({ ok: false, code: 'broken' })
  })

  it('一个接入者都没有：算接错了，不是「你的机器不行」', async () => {
    const outcome = await exportVideoInBrowser('print(1)', stubSurface(), () => {})
    expect(outcome).toEqual({ ok: false, code: 'broken' })
  })

  it('进展原样透出去（界面直接显示核心包那句话）', async () => {
    const notes: string[] = []
    const run = vi.fn((request: { onProgress?: (note: string) => void }) => {
      request.onProgress?.('逐帧编码（WebCodecs）…')
      return Promise.resolve({ ok: true, kind: 'blob', blob: new Blob(['x']), name: 'manim.mp4', mime: 'video/mp4' })
    })
    exporters.push(stubExporter({ run: run as unknown as Exporter['run'] }))
    await exportVideoInBrowser('print(1)', stubSurface(), (note) => notes.push(note))
    expect(notes).toEqual(['逐帧编码（WebCodecs）…'])
  })
})
