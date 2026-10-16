// ⚠️ **本文件当前没有界面调用者**（2026-10-17 用户定：导出入口先从界面撤出）。
//
// 实现是完整的、且在真浏览器里验过能录到会动的画面（见下面「为什么不逐帧」那段推导）。
// 撤的只是入口：卡片上的按钮、文案、回执都已移除。要恢复就把 card.tsx 里的接线加回来，
// 并把 i18n 里的 export* 键补上——那些键也一并删了，恢复时照下面这几个名字重建：
// exportReadyHint / exportMissingHint / exportPendingHint / exportBusy / exportDone / exportFailed。
//// 导出视频：**实时录制画布流**，不再调核心包/上游的逐帧导出器。
//
// ## 为什么不逐帧（这是踩过的坑，别再改回去）
//
// 上游 manim-web 有两条导出路径，**两条都是坏的**，原因同一个：
//
//   1. WebCodecs 导出器（`createWebCodecsExporter`）：循环里 `scene.seek(t)` 之后立刻抓帧。
//   2. MediaRecorder 导出器（`createVideoExporter.exportTimeline`）：`scene.seek(t)` 之后等一帧。
//
// 两条都靠 `Scene.seek()` 定位。而 `seek()` 内部是：
//
//   seek(e) { this._timeline.seek(e); this._currentTime = e; this._render() }
//
// 对比真实播放的每帧（`_tickFrame`）：
//
//   _tickFrame(dt) { for (m of mobjects) m.update(dt); this._timeline.update(dt); ...; this._render() }
//
// **`seek()` 没有那两个 `update`**。对靠 alpha 插值的动画（位移、变色）没影响，
// 但对**靠 dt 累积**的动画（updater、ValueTracker 驱动的连续运动、Rotating、PhaseFlow）
// 完全无效——它们永远推进不了。实测表现：导出的视频「有流光、但不动」。
//
// 这不是循环写法的问题，是 `seek` 语义本身不支持逐帧导出的要求；我们在外部怎么写都没用。
//
// ## 所以：让动画真播一遍，同步录画布
//
// `canvas.captureStream(fps)` 拿的是**真实渲染输出**——播放走 `_tickFrame`，updater 正常推进，
// 录下来就是「看到什么，导出什么」（本插件一直的口径）。代价是**导出耗时 ≈ 动画时长**，
// 所以进度按时间报，不假装是逐帧编码。
//
// 产物由 `MediaRecorder` 决定编码：默认 webm（vp9）；浏览器支持 `video/mp4` 时优先要 mp4。
import type { Playback, Surface } from 'manim-live'

/** 录制帧率。30 对教学动画足够，也是本插件一直用的值。 */
const FPS = 30

/**
 * 候选 MIME，按优先级排。
 *
 * 先 mp4 后 webm：mp4 兼容性更好（剪辑软件、部分播放器），但**不是每个浏览器都支持录 mp4**
 * （Chrome/Electron 多数只给 webm），所以逐个探测，用第一个能用的。
 */
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm',
] as const

/** 挑一个当前环境真的支持的录制格式；都不支持时给 null（调用方报「不支持」）。 */
function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return null
}

/** 由 MIME 定扩展名——不写死 `.mp4`，编码结果说了算。 */
function extensionFor(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm'
}

/**
 * 导出的结论。
 *
 * 成功时给 Blob 与文件名。
 *
 * 失败时**不在这里造句**：本层的用户可见文案归 `../i18n`（本插件所有文案的唯一出处），
 * 所以这里只给一个码加原料——`detail` 是原话，`missing` 是可读的能力名。
 */
export type BrowserExportOutcome =
  | { ok: true; blob: Blob; name: string }
  | { ok: false; code: 'unsupported' | 'failed'; detail?: string; missing?: string[] }

/**
 * 画布能不能被录。
 *
 * 只有一条硬性条件：`MediaRecorder` 且至少一个 MIME 可用。
 * （不再问 WebCodecs——那条路虽然能编码，但喂给它的帧是坏的，见文件头。）
 */
export function canRecordVideo(): { ok: true; mime: string } | { ok: false; missing: string[] } {
  const mime = pickMime()
  if (mime === null) return { ok: false, missing: ['MediaRecorder'] }
  return { ok: true, mime }
}

/** 等一段真实时间。 */
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 让动画真实播一遍，同时录下画布。
 *
 * 步骤：回到起点 → 起录 → 播 → 等播完 → 停录。
 *
 * **必须等播放真的结束再停录**：停早了尾部会被截断。判据用 `playback.state() === 'ended'`
 * （上游在播到末尾时会把它置成 `ended`），同时挂一个 `duration + 余量` 的兜底超时——
 * 万一中途出意外卡住，也不能把整个导出吊死。
 */
export async function exportVideoInBrowser(
  python: string,
  surface: Surface,
  onProgress: (note: string) => void,
): Promise<BrowserExportOutcome> {
  const ready = canRecordVideo()
  if (!ready.ok) return { ok: false, code: 'unsupported', missing: ready.missing }

  const canvas = surface.canvas()
  if (canvas === null) return { ok: false, code: 'failed', detail: '画布还没准备好' }

  onProgress('正在把动画排进时间轴…')
  let playback: Playback
  try {
    // 收集成可回放的时间轴：与卡片播放走同一条路，保证「导出的是同一段动画」。
    playback = await surface.createPlayback(python)
  } catch (error) {
    console.error('[manim-card] export: playback failed:', error)
    return { ok: false, code: 'failed', detail: error instanceof Error ? error.message : String(error) }
  }

  let recorder: MediaRecorder | null = null
  try {
    const duration = playback.duration()
    // 时长未知（收集出来是空的）就没有可导的东西——如实报错，别交一个空文件出去。
    if (!Number.isFinite(duration) || duration <= 0) {
      playback.dispose()
      return { ok: false, code: 'failed', detail: '这段动画没有可导出的时长' }
    }

    // 回到起点再起录：否则会从收集完停住的那一帧开始录。
    playback.seek(0)
    playback.pause()

    const stream = canvas.captureStream(FPS)
    recorder = new MediaRecorder(stream, { mimeType: ready.mime })
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    const stopped = new Promise<void>((resolve) => {
      recorder!.onstop = () => resolve()
    })

    recorder.start()
    // 录之前先让出一帧：`captureStream` 的第一帧要等画布真的被刷过才有内容，
    // 起录后立刻播会让开头缺一点。这一帧的等待很便宜。
    await wait(Math.ceil(1000 / FPS))

    onProgress(`正在录制 ${duration.toFixed(1)} 秒…`)
    playback.play()

    // 按时间报进度：这条路是实时的，进度就是「已录 / 总时长」。
    const startedAt = Date.now()
    const budget = duration * 1000 + 1000 // 兜底：总时长 + 1 秒余量
    while (Date.now() - startedAt < budget) {
      if (playback.state() === 'ended') break
      const elapsed = (Date.now() - startedAt) / 1000
      const percent = Math.min(99, Math.round((elapsed / duration) * 100))
      onProgress(`正在录制 ${duration.toFixed(1)} 秒… ${percent}%`)
      await wait(200)
    }
    // 末尾再让出一帧，保证最后一帧被 captureStream 抓进去。
    await wait(Math.ceil(1000 / FPS))

    onProgress('正在收尾…')
    recorder.stop()
    await stopped
    stream.getTracks().forEach((track) => track.stop())

    const blob = new Blob(chunks, { type: ready.mime.split(';')[0] })
    if (blob.size === 0) return { ok: false, code: 'failed', detail: '录出来的内容是空的' }

    onProgress(`导出完成 ${(blob.size / 1024).toFixed(0)} KB`)
    return { ok: true, blob, name: `manim-${Date.now()}.${extensionFor(ready.mime)}` }
  } catch (error) {
    console.error('[manim-card] browser export failed:', error)
    return { ok: false, code: 'failed', detail: error instanceof Error ? error.message : String(error) }
  } finally {
    // 无论成败都要把时间轴摘掉、把录制器收干净——留着会占住画布与编码器。
    playback.dispose()
    if (recorder !== null && recorder.state !== 'inactive') recorder.stop()
  }
}

/**
 * 把产物存进用户的「下载」文件夹。
 *
 * 用一次性 object URL + `<a download>`——浏览器导出出来的是内存里的 Blob，没有磁盘路径可给。
 * URL 撤销**推迟一拍**再做：立刻撤销会让还没读完的下载中断（大文件尤其明显），
 * 而它本来也只是个内存引用，多留十秒没有任何代价。
 */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
