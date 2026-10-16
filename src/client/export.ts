// 导出视频：接核心包**自带**的浏览器逐帧导出（`browserVideo`），不再走本机 manim CLI。
//
// 为什么只留浏览器这一条：导出的画面必须与卡片上看到的是**同一个引擎**（manim-web）。
// 换成本机 Manim CE 渲 mp4 时用的是另一套引擎，而两边对同一段代码的语义有**真实分歧**——
// 已实测的一处：`TracedPath` 一边收「物体本身」、另一边收「取点函数」，两种写法在预检里却都通过
// （干跑不跑 updater），于是卡片渲染正常、导出必炸。分歧还有没有别处没测出来的，无从穷举。
// 所以本插件的口径改成：**看到什么，导出什么**。
//
// 本机那条路（核心包 `manim-live/node` 的 `createLocalExport` + 宿主 `/export` 路由）仍在原地，
// 只是界面不再调它——要恢复就把它接回来，别把代码删了。
import { browserVideo, type Exporter, type ExportResult, type RenderController, type Surface } from 'manim-live'
import { manimRenderer } from './renderer'

/**
 * 浏览器逐帧导出的接入者。按 **id** 找而不是取下标：核心包始终把自带那个排在列表最前，
 * 但那是实现细节，按 id 认才不会被上游调序弄坏。
 */
export function browserExporter(): Exporter | null {
  return manimRenderer().exporters.find((exporter) => exporter.id === browserVideo.id) ?? null
}

/**
 * 一块画布 → 导出接入者要的那个 `RenderController`。
 *
 * 三个成员画布上都已经有了，这里只做改名（`Surface` 是给人用的名字，`RenderController` 是给导出用的），
 * 不新增任何能力。**必须传当前活着的那块画布**：`collect()` 是真在它上面跑一遍代码。
 */
export function controllerOf(surface: Surface): RenderController {
  return {
    canvas: () => surface.canvas(),
    isRendered: () => surface.isRendered(),
    collect: (python) => surface.collect(python),
  }
}

/**
 * 导出的结论。
 *
 * 成功时给 Blob 与文件名——**沿用接入者算出来的名字**，不写死 `.mp4`（WebCodecs 那条给 mp4，
 * MediaRecorder 那条给 webm，由实际编码结果定）。
 *
 * 失败时**不在这里造句**：本层的用户可见文案归 `../i18n`（本插件所有文案的唯一出处），
 * 所以这里只给一个码加原料——`detail` 是核心包给的原话，`missing` 是它给的可读名。
 */
export type BrowserExportOutcome =
  | { ok: true; blob: Blob; name: string }
  | { ok: false; code: 'unsupported' | 'failed' | 'broken'; detail?: string; missing?: string[] }

/**
 * 跑一次浏览器逐帧导出。
 *
 * 就绪判定与逐帧编码全在核心包那一侧（上游 `manim-web` 的导出器），这里只做三件事：
 * 问一句能不能用、把进展接给界面、把结论收敛成一种形状。
 */
export async function exportVideoInBrowser(
  python: string,
  surface: Surface,
  onProgress: (note: string) => void,
): Promise<BrowserExportOutcome> {
  const exporter = browserExporter()
  if (exporter === null) return { ok: false, code: 'broken' }

  const ready = await exporter.probe()
  if (!ready.ready) {
    return { ok: false, code: 'unsupported', missing: (ready.missing ?? []).map((item) => item.label) }
  }

  let result: ExportResult
  try {
    result = await exporter.run({ python, controller: controllerOf(surface), onProgress })
  } catch (error) {
    console.error('[manim-card] browser export failed:', error)
    return { ok: false, code: 'failed', detail: error instanceof Error ? error.message : String(error) }
  }

  if (!result.ok) return { ok: false, code: 'failed', detail: result.error }
  // 本机那条路才回 `kind: 'file'`；浏览器导出只会回 blob，真回了 file 说明接错了实现。
  if (result.kind !== 'blob') return { ok: false, code: 'broken' }
  return { ok: true, blob: result.blob, name: result.name }
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
