/**
 * 环境状态进界面的一层：核心包 `environmentStatus()` 的快照 / 订阅，加上「状态 → 状态点颜色」
 * 与「状态 → 待处理项」的纯映射。
 *
 * 为什么单独一个文件：设置卡、实验场状态条、聊天卡片都要看同一份状态（订阅只能写一处），
 * 而映射与选择器是纯函数——能被测试按住，不碰 DOM 也不碰 React 渲染结果。
 *
 * 两套环境在这里合流，因为它们回答的是同一个问题「这台机器还缺什么」：
 * - **浏览器侧**（核心包）：WebAssembly / WebGL / 录屏能力、Python 运行时、公式样式、按需取包 —— 管**渲染**；
 * - **本机侧**（Host 路由）：本机的 Manim / Python / FFmpeg / LaTeX —— 管**导出 mp4**。
 * 前者的事发生在浏览器里，Host 问不到；后者发生在操作系统里，浏览器探测不了。所以两条取数路径，一个界面出口。
 */
import { useEffect, useState } from 'react'
import { environmentStatus, onEnvironmentStatus, type EnvironmentCapabilities, type EnvironmentStatus, type KatexPhase, type RuntimePhase } from 'manim-live'
import { loadExportReadiness, type ExportMissing } from './export'
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

/** 阶段 → 文案键（写死表，不拼键名）。设置卡与状态条共用这一份。 */
export const RUNTIME_PHRASE: Record<RuntimePhase, string> = { idle: 'rtIdle', loading: 'rtLoading', ready: 'rtReady', error: 'rtError' }
export const KATEX_PHRASE: Record<KatexPhase, string> = { unconfigured: 'rtUnconfigured', loading: 'rtLoading', loaded: 'rtLoaded', error: 'rtError' }

/** 订阅浏览器环境状态；卸载自动退订。首值取快照，所以第一帧就有内容、不闪空。 */
export function useEnvironmentStatus(): EnvironmentStatus {
  const [status, setStatus] = useState<EnvironmentStatus>(environmentStatus)
  useEffect(() => onEnvironmentStatus(setStatus), [])
  return status
}

// ---- 本机环境（导出 mp4 走的那一套）----

/**
 * 本机环境的就绪结论。`checking` 与 `unknown` 要分开：
 * 前者是「还在问」，后者是「问不到」（Host 没起来之类）——两者的界面表现完全不同，
 * 合成一个态会让「还没问完」看起来像「本机不行」。
 */
export type LocalEnvState =
  | { phase: 'checking' }
  | { phase: 'ready' }
  | { phase: 'missing'; missing: ExportMissing[] }
  | { phase: 'unknown' }

/**
 * 取本机环境的就绪结论。走的是卡片导出按钮用的那条路（Host 侧带 TTL 缓存），
 * 所以整页同时挂几十张卡也不会各跑一遍探测；`refresh()` 强制再问一次。
 */
export function useLocalEnv(): { state: LocalEnvState; refresh: () => void } {
  const [state, setState] = useState<LocalEnvState>({ phase: 'checking' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setState({ phase: 'checking' })
    loadExportReadiness()
      .then((value) => {
        if (!alive) return
        setState(value.ready ? { phase: 'ready' } : { phase: 'missing', missing: value.missing })
      })
      .catch((error) => {
        console.error('[manim-card] 本机环境就绪结论取不到:', error)
        if (alive) setState({ phase: 'unknown' })
      })
    return () => {
      alive = false
    }
  }, [attempt])
  return { state, refresh: () => setAttempt((n) => n + 1) }
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

/**
 * 探测项 id → 设置页同款可读名。卡片与状态条**共用这一张表**：
 * 两处各写一张的话，Host 加一项探测就会出现「卡片认得出、状态条只显示 id」。
 */
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

// ---- 状态条：四条条件的 chip ----

/** 四条条件：本机 Manim（导出）、运行时与公式样式（渲染的两级前置）、浏览器能力。 */
export type ChipId = 'local' | 'runtime' | 'katex' | 'caps'

export interface StatusChip {
  id: ChipId
  tone: StatusTone
  /** 短组名（chip 上显示）。 */
  label: string
  /** 状态词（就绪 / 未加载 / 缺 2 项…）。 */
  value: string
  /** 这一枚自己的说明（悬浮提示用）；没有额外可说的就缺席。 */
  detail?: string
  /** 只有不满足的 chip 可点（点开看待处理项与动作）；满足的是纯标签。 */
  actionable: boolean
}

/**
 * 四条条件 → 四枚 chip。纯函数（`t` 只是取词）：同一个快照进来，出去的东西每次都一样，
 * 于是能拿假 `t` 把「哪种状态算可点、文案怎么取」钉在测试里。
 */
export function chipsOf(input: { t: Translate; status: EnvironmentStatus; local: LocalEnvState }): StatusChip[] {
  const { t, status, local } = input
  const caps = missingCapabilities(status.capabilities)
  const localMissing = local.phase === 'missing' ? local.missing : []
  const localTone: StatusTone = local.phase === 'checking'
    ? 'busy'
    : local.phase === 'ready'
      ? 'ok'
      : local.phase === 'missing'
        ? 'warn'
        : 'idle'
  return [
    {
      id: 'local',
      tone: localTone,
      label: t('chipLocal'),
      value: local.phase === 'checking'
        ? t('chipChecking')
        : local.phase === 'ready'
          ? t('chipReady')
          : local.phase === 'missing'
            ? t('chipMissing', { count: localMissing.length })
            : t('chipUnknown'),
      ...(localMissing.length === 0
        ? {}
        : { detail: t('chipLocalMissing', { items: missingLabels(localMissing, t) }) }),
      actionable: localMissing.length > 0 || local.phase === 'unknown',
    },
    {
      id: 'runtime',
      tone: runtimeTone(status.runtime.phase),
      label: t('chipRuntime'),
      value: t(RUNTIME_PHRASE[status.runtime.phase]),
      detail: status.runtime.error ?? t('rtIndexWhy', { url: status.runtime.indexURL ?? '' }),
      actionable: status.runtime.phase === 'idle' || status.runtime.phase === 'error',
    },
    {
      id: 'katex',
      tone: katexTone(status.katex.phase),
      label: t('chipKatex'),
      value: t(KATEX_PHRASE[status.katex.phase]),
      detail: status.katex.error ?? (status.katex.baseURL === null ? t('rtKatexWhy') : t('rtKatexAt', { url: status.katex.baseURL })),
      actionable: status.katex.phase === 'error',
    },
    {
      id: 'caps',
      tone: caps.length > 0 ? 'error' : 'ok',
      label: t('chipCaps'),
      value: caps.length > 0 ? t('chipMissing', { count: caps.length }) : t('chipReady'),
      ...(caps.length === 0 ? {} : { detail: caps.map((name) => t(name === 'wasm' ? 'rtWasmWhy' : name === 'webgl' ? 'rtWebglWhy' : 'rtRecorderWhy')).join(' ') }),
      actionable: caps.length > 0,
    },
  ]
}

/**
 * 状态条展开后要说的全部话：浏览器侧的可执行句在前面（核心包给的，原样），
 * 本机侧与「运行时还没起来」这两条在后面。
 *
 * 为什么把浏览器侧与运行时那句也收进来：这一栏是「这台机器还缺什么」的唯一出口，
 * 点开哪一枚都该看到全景——分成四份各说各的，用户还得逐枚点过去才能拼出全貌。
 */
export function pendingHints(input: { t: Translate; status: EnvironmentStatus; local: LocalEnvState }): string[] {
  const { t, status, local } = input
  const out = [...status.hints]
  // 「还没加载」不是错，但第一次渲染要等 13 MB 下来——这句话该说，只是不进 hints（那是「不满足项」）。
  if (status.runtime.phase === 'idle') out.push(t('chipRuntimeCold'))
  if (local.phase === 'missing' && local.missing.length > 0) out.push(t('chipLocalMissing', { items: missingLabels(local.missing, t) }))
  return out
}
