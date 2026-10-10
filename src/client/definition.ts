// 会话折叠定义：一次 manim_render 调用 = 一张渲染卡片，锚定在调用处（id 含 callId）。
// start 取调用参数（python 源码）；随后同 callId 的 tool/result 作为 update 折进来——
// Host 已先预检过一遍，ok:false 时卡片直接显示错误、不再起画布重跑。
// fork / 重放按日志天然重建。
export interface ManimFeedback {
  ok: boolean
  error?: string
}

export interface ManimCardData {
  python: string
  callId: string
  /**
   * 这一批（同一个 step）的标识，形如 `1:2`；认不出 step 时是 `call:${callId}`（自成一批）。
   *
   * 为什么需要：模型会在**同一个 step 里并行发好几个** `manim_render`（真实轨迹里见过 3 个，
   * 形如 `call_00_` / `call_01_` / `call_02_`）。一个 step 只真播一张——用户等的其实是结果，
   * 不是 2~3 段动画接连演完（那要 6~9 秒，后几张全程骨架屏）。判定见 render-queue 的
   * `isBatchTail`。
   */
  stepKey: string
  /** 事件序号（`tool/call` 的 seq）：同一批里比谁最后到，也用它排预热顺序。 */
  seq: number
  /** Host 侧预检回执；缺省 = 尚未回执（仍按可渲染处理）。 */
  feedback?: ManimFeedback
  /**
   * 这是一张**刚生成出来的**卡，值得自动放一次动画——而不是打开老会话时回填出来的历史卡。
   *
   * 聊天里由「收录这张卡时，它所在的那一轮还开着」判定（`location.turn.status`）——
   * **见过一次 open 就永久成立**（理由见 `bornLive`：这个位置会被反复重放，现算会翻面）；
   * 实验场里凡用户点了渲染的那一条就是（它本来就刚被要求）。不置位的卡一律直接落末帧。
   */
  live?: true
  /** 这次调用被中断过：宿主给的收尾不是回执、而是「这次没跑成」。卡片照在，但别装作跑过了。 */
  interrupted?: true
}

interface FoldContentItem {
  type?: string
  text?: string
}

interface FoldEventData {
  name?: string
  arguments?: string
  callId?: string
  message?: { source?: { callId?: string }; content?: readonly FoldContentItem[]; isError?: unknown }
}

/** 事件在会话层级里的落点（引擎给的）。这里只用两件事：所在那一轮还开着没有、是不是同一个 step。 */
interface FoldLocation {
  turn?: { status?: unknown; turn?: unknown }
  step?: { step?: unknown }
}

interface FoldEvent {
  type: string
  data?: FoldEventData
  seq?: number
  surfaceOp?: unknown
}

interface FoldMatch {
  event: FoldEvent
  role: 'start' | 'update'
  location?: FoldLocation
}

interface FoldContext {
  state: ManimCardData
  key: string
  id: string
  start?: { event: FoldEvent; location: unknown }
}

/** 工具参数是 JSON 字符串，坏数据一律当空对象（卡片会落到"数据不完整"占位）。 */
function safeArguments(raw: string | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

/** tool/result 的文本内容：Host 的回执、或宿主自己的收尾文案都落在这儿。 */
function receiptText(event: FoldEvent): string | undefined {
  const text = event.data?.message?.content?.find((item) => item?.type === 'text')?.text
  return typeof text === 'string' ? text : undefined
}

/** 从回执文本里读出 Host 预检回执；读不出就按"未回执"处理（不当错误，见 update 里的分寸）。 */
function readFeedback(text: string | undefined): ManimFeedback | undefined {
  if (text === undefined) return undefined
  try {
    const value = JSON.parse(text) as { ok?: unknown; error?: unknown }
    if (typeof value?.ok !== 'boolean') return undefined
    return { ok: value.ok, ...(typeof value.error === 'string' ? { error: value.error } : {}) }
  } catch {
    return undefined
  }
}

/**
 * 这次调用的收尾是不是「没跑成」。
 *
 * 工具被中断时（用户按停止、宿主收尾），落在日志里的是 `Error: tool call aborted` 这类**宿主文案**，
 * 带 `isError: true`——不是我们那套 `{ok:boolean}` 回执。原来这里读不出回执就当作「没有回执」，
 * 卡片于是照常起画布渲染，看着像"报错了但卡片还在跑"。所以：**宿主说这次没跑成，就得让卡片知道**。
 *
 * 与「预检不通过」区分开：那种是我们自己的回执（`{"ok":false,"error":"第 N 行…"}`），
 * 读得出 ok 字段，归 rejected 那条路，不是中断。
 */
function readInterrupted(event: FoldEvent): boolean {
  if (event.data?.message?.isError !== true) return false
  return readFeedback(receiptText(event)) === undefined
}

/**
 * 「这张卡是刚出炉的」——**见过一次就是真的**，此后不再翻面。
 *
 * 为什么不能每次现算：`start()` 在流式过程中会被引擎反复重放。拿真事件流实测（用宿主自己的
 * assembler 灌一条真实会话），同一张卡在流式期间跑了 4 次、`turn/end` 之后又跑第 5 次——
 * 而第 5 次时那张卡所在的一轮已经关闭，`location.turn.status` 从 `open` 变成了 `closed`。
 * 也就是说「这张卡算不算刚生成」会随重放翻面，于是同一张卡有时正常播、有时直接落末帧，
 * 差别只取决于**它什么时候被挂载**。用户看到的就是「第一张莫名其妙跳到了末帧」。
 *
 * 于是把「见过 open」记在模块里，只加不减；引擎给的状态在 `start()` 之前就被清空了
 * （`assembler.ts` 里 `context.state = undefined` 紧挨着调用），借不到上一次的结果，只能自己记。
 *
 * 打开老会话时整窗重折、那一轮早就 closed，一张都记不上——「老会话不播」由构造保证，
 * 不必再依赖「采样时机恰好赶上 open」这种运气。
 */
const bornLive = new Set<string>()

function readLive(match: FoldMatch): boolean {
  const callId = String(match.event.data?.callId ?? '')
  if (match.location?.turn?.status === 'open') bornLive.add(callId)
  return callId !== '' && bornLive.has(callId)
}

/**
 * 这批多大：同一个 step 的卡算一批，一批只真播一张（见 render-queue 的 `isBatchTail`）。
 *
 * 认不出 step 时**每张卡各算一批**（键带上 callId，而不是落回一个空串）：落回空串会让所有
 * 「认不出」的卡挤成同一批、结果只播一张——那等于凭一次采样失败就把几张卡的动画吃掉。
 * 宁可多播一张，也不能少播。
 */
function readBatch(match: FoldMatch, callId: string): { stepKey: string; seq: number } {
  const turn = match.location?.turn?.turn
  const step = match.location?.step?.step
  const raw = match.event.seq
  const seq = typeof raw === 'number' && Number.isSafeInteger(raw) ? raw : 0
  return {
    stepKey: typeof step === 'number' ? `${typeof turn === 'number' ? turn : '?'}:${step}` : `call:${callId}`,
    seq,
  }
}

export const definition = {
  kind: 'manim-render',
  target: 'chat',
  match: (event: FoldEvent): { id: string; role: 'start' | 'update' } | null => {
    if (event.type === 'tool/call') {
      if (event.data?.name !== 'manim_render') return null
      return { id: `manim-${event.data?.callId ?? ''}`, role: 'start' }
    }
    // 只认同位落盘的 tool/result（append）；替换副本留给模型面，不进人工转写。
    if (event.type === 'tool/result' && event.surfaceOp === 'append') {
      const callId = event.data?.message?.source?.callId
      if (typeof callId !== 'string' || callId === '') return null
      return { id: `manim-${callId}`, role: 'update' }
    }
    return null
  },
  start: (_context: FoldContext, match: FoldMatch): ManimCardData => {
    const args = safeArguments(match.event.data?.arguments)
    const callId = String(match.event.data?.callId ?? '')
    return {
      python: typeof args.python === 'string' ? args.python : '',
      callId,
      ...readBatch(match, callId),
      ...readLive(match) ? { live: true as const } : {},
    }
  },
  update: (context: FoldContext, match: FoldMatch): ManimCardData => {
    if (match.event.type !== 'tool/result') return context.state
    const text = receiptText(match.event)
    const feedback = readFeedback(text)
    if (feedback !== undefined) return { ...context.state, feedback }
    // 中断收尾（宿主说这次没跑成）：认出来就走 interrupted，不打日志——那不是「怪数据」。
    if (readInterrupted(match.event)) return { ...context.state, interrupted: true }
    // 其余认不出的回执才留一条：宿主哪天换了收尾格式，能从这儿查出来。
    if (text !== undefined) console.error('[manim-live] 工具回执认不出:', text.slice(0, 200))
    return context.state
  },
  buildViewNode: (context: FoldContext) => {
    if (context.start === undefined) return null
    return {
      key: context.key,
      kind: 'manim-render',
      id: context.id,
      target: 'chat',
      anchorSeq: context.start.event.seq,
      location: context.start.location,
      visibility: 'visible',
      data: context.state,
    }
  },
}