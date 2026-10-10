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
  /** Host 侧预检回执；缺省 = 尚未回执（仍按可渲染处理）。 */
  feedback?: ManimFeedback
  /**
   * 这是一张**刚出炉**的卡，值得自动放一次动画——而不是打开老会话时回填出来的历史卡。
   *
   * 聊天里由「收录这张卡时，它所在的那一轮还开着」判定（`location.turn.status`）；
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

/** 事件在会话层级里的落点（引擎给的）。这里只用到「所在那一轮还开着没有」。 */
interface FoldLocation {
  turn?: { status?: unknown }
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

/** 从回执文本里读出 Host 预检回执；读不出就按"未回执"处理。 */
function readFeedback(text: string | undefined, log: boolean): ManimFeedback | undefined {
  if (text === undefined) return undefined
  try {
    const value = JSON.parse(text) as { ok?: unknown; error?: unknown }
    if (typeof value?.ok !== 'boolean') return undefined
    return { ok: value.ok, ...(typeof value.error === 'string' ? { error: value.error } : {}) }
  } catch (error) {
    // 中断收尾（`Error: tool call aborted`）本来就不是 JSON，不当噪音打日志
    if (log) console.error('[manim-renderer] 工具回执不是 JSON:', error)
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
  return readFeedback(receiptText(event), false) === undefined
}

/** 收录这张卡时它所在的那一轮还开着没有；读不出就不算（宁可静态，也不要乱播一遍）。 */
function readLive(match: FoldMatch): boolean {
  return match.location?.turn?.status === 'open'
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
    return {
      python: typeof args.python === 'string' ? args.python : '',
      callId: String(match.event.data?.callId ?? ''),
      ...readLive(match) ? { live: true as const } : {},
    }
  },
  update: (context: FoldContext, match: FoldMatch): ManimCardData => {
    if (match.event.type !== 'tool/result') return context.state
    const feedback = readFeedback(receiptText(match.event), true)
    if (feedback !== undefined) return { ...context.state, feedback }
    return readInterrupted(match.event) ? { ...context.state, interrupted: true } : context.state
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