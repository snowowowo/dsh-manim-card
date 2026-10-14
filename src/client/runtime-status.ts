/**
 * 环境状态进界面的一层：核心包 `environmentStatus()` 的快照 / 订阅，加上「状态 → 状态点颜色」
 * 与「状态 → 待处理项」的纯映射。
 *
 * 为什么单独一个文件：设置卡与聊天卡片都要看同一份状态（订阅只能写一处），
 * 而映射与选择器是纯函数——能被测试按住，不碰 DOM 也不碰 React 渲染结果。
 *
 * 两套环境在这里合流，因为它们回答的是同一个问题「这台机器还缺什么」：
 * - **浏览器侧**（核心包）：WebAssembly / WebGL / 录屏能力、Python 运行时、公式样式、按需取包 —— 管**渲染**；
 * - **本机侧**（Host 路由）：本机的 Manim / Python / FFmpeg / LaTeX —— 管**导出 mp4**。
 * 前者的事发生在浏览器里，Host 问不到；后者发生在操作系统里，浏览器探测不了。所以两条取数路径，一个界面出口。
 */
import { useEffect, useState } from 'react'
import { environmentStatus, onEnvironmentStatus, type EnvironmentCapabilities, type EnvironmentStatus, type KatexPhase, type RuntimePhase } from 'manim-live'
import type { ExportMissing } from './export'
import type { Translate } from './i18n'

/** 与设置页状态点同一套语义：绿=好、黄=要注意、红=错、灰=中性、空环=没有、转圈=进行中。 */
export type StatusTone = 'ok' | 'warn' | 'error' | 'idle' | 'empty' | 'busy'

/** 运行时阶段 → 色调：没加载是「还没有」（空环），不是错。 */
export function runtimeTone(phase: RuntimePhase): StatusTone {
  if (phase === 'ready') return 'ok'
  if (phase === 'loading') return 'busy'
  if (phase === 'error') return 'error'
  return 'empty'
}

/** KaTeX → 色调：未配置是「没有」（空环）；公式用不用得上由代码决定，这里不猜。 */
export function katexTone(phase: KatexPhase): StatusTone {
  if (phase === 'loaded') return 'ok'
  if (phase === 'loading') return 'busy'
  if (phase === 'error') return 'error'
  return 'empty'
}

/** 能力项 → 色调：缺能力是硬伤，红。 */
export function capabilityTone(present: boolean): StatusTone {
  return present ? 'ok' : 'error'
}

/** 阶段 → 文案键（写死表，不拼键名）。设置卡用这一份。 */
export const RUNTIME_PHRASE: Record<RuntimePhase, string> = { idle: 'rtIdle', loading: 'rtLoading', ready: 'rtReady', error: 'rtError' }
export const KATEX_PHRASE: Record<KatexPhase, string> = { unconfigured: 'rtUnconfigured', loading: 'rtLoading', loaded: 'rtLoaded', error: 'rtError' }

/** 订阅浏览器环境状态；卸载自动退订。首值取快照，所以第一帧就有内容、不闪空。 */
export function useEnvironmentStatus(): EnvironmentStatus {
  const [status, setStatus] = useState<EnvironmentStatus>(environmentStatus)
  useEffect(() => onEnvironmentStatus(setStatus), [])
  return status
}

// ---- 纯选择器：状态 → 界面上要说的那几句话 ----

/** 缺哪几项浏览器能力。顺序固定，便于对照测试与界面稳定。 */
export function missingCapabilities(caps: EnvironmentCapabilities): Array<'wasm' | 'webgl' | 'recorder'> {
  const out: Array<'wasm' | 'webgl' | 'recorder'> = []
  if (!caps.wasm) out.push('wasm')
  if (!caps.webgl) out.push('webgl')
  if (!caps.videoExport) out.push('recorder')
  return out
}

/**
 * 环境里有没有**会挡住渲染**的硬伤：解释器起不来 / WebAssembly 与 WebGL 缺席 / 取包失败。
 *
 * 缺 MediaRecorder **不算**——它只影响「浏览器直接录屏」那一种导出方式，
 * 渲染与导出 mp4 都不走它（核心包的 hint 里也写明了这一点）。
 */
export function blocksRender(status: EnvironmentStatus): boolean {
  return !status.capabilities.wasm
    || !status.capabilities.webgl
    || status.runtime.phase === 'error'
    || status.packages.lastError !== undefined
}

/**
 * 渲染失败时该补的说明：环境里真有硬伤才给（把核心包给的可执行句原样摆出来）。
 * 拿去即用——判据全在上面的 `blocksRender`，卡片那侧不再自己判一遍。
 */
export function renderBlockHints(): string[] {
  const status = environmentStatus()
  return blocksRender(status) ? status.hints : []
}

/** 探测项 id → 设置页同款可读名。卡片用这一张表（Host 加一项探测时补这里即可）。 */
const MISSING_NAMES: Record<string, string> = {
  python3: 'envPython3',
  manim: 'envManim',
  manimModule: 'envManimModule',
  ffmpeg: 'envFfmpeg',
  latex: 'envLatex',
  dvisvgm: 'envDvisvgm',
}

/** 缺的那几项拼成一句话里的一段（表里没有的 id 原样显示，比空着强）。 */
export function missingLabels(missing: ExportMissing[], t: Translate): string {
  return missing
    .map((item) => {
      const key = MISSING_NAMES[item.id]
      return key === undefined ? item.id : t(key)
    })
    .join('、')
}

