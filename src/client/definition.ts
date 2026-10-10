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
}

interface FoldContentItem {
  type?: string
  text?: string
}

interface FoldEventData {
  name?: string
  arguments?: string
  callId?: string
  message?: { source?: { callId?: string }; content?: readonly FoldContentItem[] }
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

/** 从 tool/result 的文本内容里读出 Host 预检回执；读不出就按"未回执"处理。 */
function readFeedback(event: FoldEvent): ManimFeedback | undefined {
  const text = event.data?.message?.content?.find((item) => item?.type === 'text')?.text
  if (typeof text !== 'string') return undefined
  try {
    const value = JSON.parse(text) as { ok?: unknown; error?: unknown }
    if (typeof value?.ok !== 'boolean') return undefined
    return { ok: value.ok, ...(typeof value.error === 'string' ? { error: value.error } : {}) }
  } catch (error) {
    console.error('[manim-renderer] 工具回执不是 JSON:', error)
    return undefined
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
    return {
      python: typeof args.python === 'string' ? args.python : '',
      callId: String(match.event.data?.callId ?? ''),
    }
  },
  update: (context: FoldContext, match: FoldMatch): ManimCardData => {
    if (match.event.type !== 'tool/result') return context.state
    const feedback = readFeedback(match.event)
    return feedback === undefined ? context.state : { ...context.state, feedback }
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