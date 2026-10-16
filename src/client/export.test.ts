/**
 * 导出接线：**实时录制画布流**——不再问核心包的导出器，也不再逐帧 seek。
 *
 * 为什么整块换掉（改回去之前先读这段）：上游两条导出路径都靠 `Scene.seek()` 定位，
 * 而 `seek()` 不像真实播放那样推进 updater（见 `./export.ts` 文件头的完整推导）。
 * 实测后果是导出的视频「有流光但不动」。所以本插件改成：让动画真播一遍、同步录画布。
 *
 * 要钉住的事：
 *  - 能力判据只看 `MediaRecorder` + 至少一种可用 MIME（不再看 WebCodecs）；
 *  - **不碰上游导出器**——`manim-live` 的替身故意不给 `browserVideo` 的那些成员，
 *    一旦实现退回去调它，这里会当场炸；
 *  - 录制起止成对：无论成败都要 `dispose()` 时间轴、把 MediaRecorder 停掉；
 *  - 时长为 0 的动画如实报错，不交一个空文件出去。
 *
 * 真编码是浏览器的事，不在单测里跑；这里全是替身。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canRecordVideo, exportVideoInBrowser } from './export'
import type { Playback, Surface } from 'manim-live'

/** 记录每次录制的输入；`onstop` 由测试自己触发，好控制「收尾」这个时刻。 */
class FakeRecorder {
  static instances: FakeRecorder[] = []
  static supported = ['video/webm;codecs=vp9']
  static chunks: Blob[] = [new Blob(['video-bytes'])]

  static isTypeSupported(mime: string): boolean {
    return FakeRecorder.supported.includes(mime)
  }

  state: 'inactive' | 'recording' = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  readonly mimeType: string

  constructor(_stream: unknown, options: { mimeType: string }) {
    this.mimeType = options.mimeType
    FakeRecorder.instances.push(this)
  }

  start(): void {
    this.state = 'recording'
    for (const chunk of FakeRecorder.chunks) this.ondataavailable?.({ data: chunk })
  }

  stop(): void {
    this.state = 'inactive'
    this.onstop?.()
  }
}

/** 假画布：只给录制要用的那两样（canvas 与 createPlayback）。 */
function stubSurface(options: { duration?: number; canvas?: null } = {}): Surface & { playback: Playback & { disposed: boolean } } {
  const duration = options.duration ?? 0.05
  const playback = {
    disposed: false,
    duration: () => duration,
    time: () => 0,
    fps: () => 30,
    state: () => 'ended' as const,
    seek: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    step: vi.fn(),
    segments: () => [],
    dispose(this: { disposed: boolean }) { this.disposed = true },
  }
  return {
    playback: playback as unknown as Playback & { disposed: boolean },
    canvas: () => (options.canvas === undefined
      ? ({ captureStream: () => ({ getTracks: () => [{ stop: vi.fn() }] }) } as unknown as HTMLCanvasElement)
      : options.canvas),
    isRendered: () => true,
    createPlayback: () => Promise.resolve(playback as unknown as Playback),
  } as unknown as Surface & { playback: Playback & { disposed: boolean } }
}

beforeEach(() => {
  FakeRecorder.instances.length = 0
  FakeRecorder.supported = ['video/webm;codecs=vp9']
  FakeRecorder.chunks = [new Blob(['video-bytes'])]
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('canRecordVideo：能力判据', () => {
  it('至少一种 MIME 可用就算能录，回它挑中的那个', () => {
    expect(canRecordVideo()).toEqual({ ok: true, mime: 'video/webm;codecs=vp9' })
  })

  it('优先要 mp4——它在剪辑软件里更通用', () => {
    FakeRecorder.supported = ['video/mp4', 'video/webm;codecs=vp9']
    expect(canRecordVideo()).toEqual({ ok: true, mime: 'video/mp4' })
  })

  it('一种都不支持：回缺 MediaRecorder 这一项，交给上层出文案', () => {
    FakeRecorder.supported = []
    expect(canRecordVideo()).toEqual({ ok: false, missing: ['MediaRecorder'] })
  })
})

describe('跑一次导出', () => {
  it('成功：回 Blob 与按格式定的文件名', async () => {
    const outcome = await exportVideoInBrowser('print(1)', stubSurface(), () => {})
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.blob.size).toBeGreaterThan(0)
    expect(outcome.name.endsWith('.webm')).toBe(true)
  })

  it('mp4 可用时文件名给 .mp4，不写死 webm', async () => {
    FakeRecorder.supported = ['video/mp4']
    const outcome = await exportVideoInBrowser('print(1)', stubSurface(), () => {})
    expect(outcome.ok && outcome.name.endsWith('.mp4')).toBe(true)
  })

  it('浏览器不能录：压根不去建时间轴（判据是门，不是提示）', async () => {
    FakeRecorder.supported = []
    const surface = stubSurface()
    const createPlayback = vi.spyOn(surface, 'createPlayback')
    const outcome = await exportVideoInBrowser('print(1)', surface, () => {})
    expect(outcome).toEqual({ ok: false, code: 'unsupported', missing: ['MediaRecorder'] })
    expect(createPlayback).not.toHaveBeenCalled()
  })

  it('时长是 0：如实报错，不交空文件出去', async () => {
    const outcome = await exportVideoInBrowser('print(1)', stubSurface({ duration: 0 }), () => {})
    expect(outcome).toEqual({ ok: false, code: 'failed', detail: '这段动画没有可导出的时长' })
  })

  it('画布不在（还没渲染）：当成失败，别去 captureStream', async () => {
    const outcome = await exportVideoInBrowser('print(1)', stubSurface({ canvas: null }), () => {})
    expect(outcome.ok).toBe(false)
    expect(!outcome.ok && outcome.detail).toBe('画布还没准备好')
  })

  it('时间轴失败：原样带出原因', async () => {
    const surface = stubSurface()
    vi.spyOn(surface, 'createPlayback').mockRejectedValueOnce(new Error('收集炸了'))
    const outcome = await exportVideoInBrowser('print(1)', surface, () => {})
    expect(outcome).toEqual({ ok: false, code: 'failed', detail: '收集炸了' })
  })

  it('录出来是空的：算失败，不交一个 0 字节的文件', async () => {
    FakeRecorder.chunks = []
    const outcome = await exportVideoInBrowser('print(1)', stubSurface(), () => {})
    expect(outcome.ok).toBe(false)
    expect(!outcome.ok && outcome.detail).toBe('录出来的内容是空的')
  })

  it('收尾把时间轴摘掉——留着会占住画布', async () => {
    const surface = stubSurface()
    await exportVideoInBrowser('print(1)', surface, () => {})
    expect(surface.playback.disposed).toBe(true)
  })

  it('导出前先把时间轴退回 0，否则录的是收集完停住的那一帧', async () => {
    const surface = stubSurface()
    await exportVideoInBrowser('print(1)', surface, () => {})
    expect(surface.playback.seek).toHaveBeenCalledWith(0)
  })

  it('进展原样透出去（界面直接显示这些话）', async () => {
    const notes: string[] = []
    await exportVideoInBrowser('print(1)', stubSurface(), (note) => notes.push(note))
    expect(notes.some((note) => note.includes('正在把动画排进时间轴'))).toBe(true)
    expect(notes.some((note) => note.includes('正在录制'))).toBe(true)
  })
})
