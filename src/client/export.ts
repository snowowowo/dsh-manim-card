// 导出视频的取数：就绪结论（按钮亮不亮）与真导出（点了按钮之后）。
//
// 为什么就绪结论单独一条 GET：卡片在聊天流里一挂就是几十张，每张都要知道「能不能导出」，
// 但答案同一时刻只有一个——Host 侧带 TTL 缓存（见 host/export.js），这里只管按卡片取。

const EXPORT_URL = '/dsh-plugins/manim-renderer/export'

/** 缺的一项必要条件。`id` 是探测项标识（客户端按它换成可读名），`detail` 是 Host 给的原始说明。 */
export interface ExportMissing {
  id: string
  detail: string
}

/** 就绪结论：`ready` 为 false 时 `missing` 说明缺什么（按钮置灰 + 悬停提示直接用）。 */
export interface ExportReadiness {
  ready: boolean
  missing: ExportMissing[]
}

export type ExportResult =
  | { ok: true; file: string; quality: string }
  | { ok: false; reason: 'input' | 'environment' | 'render'; error?: string; missing?: ExportMissing[] }

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseMissing(value: unknown): ExportMissing[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((raw): raw is Record<string, unknown> => raw !== null && typeof raw === 'object')
    .map((raw) => ({ id: text(raw.id), detail: text(raw.detail) }))
    .filter((item) => item.id.length > 0)
}

/** 就绪结论；形状不对回 null（调用方据此把按钮按「未知」处理——置灰 + 出错提示）。 */
export function parseReadiness(payload: unknown): ExportReadiness | null {
  if (payload === null || typeof payload !== 'object') return null
  const value = payload as Record<string, unknown>
  if (typeof value.ready !== 'boolean') return null
  return { ready: value.ready, missing: parseMissing(value.missing) }
}

/** 拿就绪结论（Host 侧有缓存，很快；首次会真跑一遍探测，可能几秒）。 */
export async function loadExportReadiness(): Promise<ExportReadiness> {
  const response = await fetch(`${EXPORT_URL}/ready`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const readiness = parseReadiness(await response.json())
  if (readiness === null) throw new Error('就绪结论形状不对')
  return readiness
}

/** 真导出：把源码交给本机 manim 渲染成 mp4，回文件路径。HTTP 层失败抛错，业务失败走 `ok:false`。 */
export async function requestExport(python: string): Promise<ExportResult> {
  const response = await fetch(EXPORT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ python }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const value = (await response.json()) as Record<string, unknown>
  if (value.ok === true && typeof value.file === 'string') {
    return { ok: true, file: value.file, quality: text(value.quality) || 'h' }
  }
  if (value.ok === false) {
    const reason = value.reason
    const valid = reason === 'input' || reason === 'environment' || reason === 'render'
    return {
      ok: false,
      reason: valid ? reason : 'render',
      error: text(value.error),
      missing: parseMissing(value.missing),
    }
  }
  throw new Error('导出结果形状不对')
}

/**
 * 在系统的文件浏览器里定位导出的文件（macOS 是 Finder 里选中它）。
 * Host 只认导出目录（「下载」）里的文件，越界会回 `ok:false` 与原因——那不是错误，是拒绝。
 */
export async function revealExport(path: string): Promise<{ ok: boolean; error: string }> {
  const response = await fetch(`${EXPORT_URL}/reveal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const value = (await response.json()) as Record<string, unknown>
  return { ok: value.ok === true, error: text(value.error) }
}
