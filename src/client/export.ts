// 导出视频的取数：绑定核心包的导出客户端到本插件的路由。
// 形状校验口径（读不通的都往保守那一侧倒：就绪 = 不可用、定位 = 失败）都在核心包
// `manim-live`——黑板等任何消费者都能用，不必依赖本插件。
import {
  createExportClient,
  type ExportMissing,
  type ExportReadiness,
  type LocalExportResult as ExportResult,
  type RevealCode,
  type RevealResult,
} from 'manim-live'
import { EXPORT_ROUTE } from '../routes.js'

const client = createExportClient({ exportUrl: EXPORT_ROUTE })

/** 拿就绪结论（Host 侧有缓存，很快；首次会真跑一遍探测，可能几秒）。 */
export const loadExportReadiness = (): Promise<ExportReadiness> => client.loadExportReadiness()

/** 真导出：把源码交给本机 manim 渲染成 mp4，回文件路径。HTTP 层失败抛错，业务失败走 `ok:false`。 */
export const requestExport = (python: string): Promise<ExportResult> => client.requestExport(python)

/** 在系统的文件浏览器里定位导出的文件；`checkOnly` 只问「还在不在」，不打开（恢复导出记录时核对用）。 */
export const revealExport = (path: string, options?: { checkOnly?: boolean }): Promise<RevealResult> =>
  client.revealExport(path, options)

export type { ExportMissing, ExportReadiness, RevealCode, RevealResult } from 'manim-live'
export type { LocalExportResult as ExportResult } from 'manim-live'
