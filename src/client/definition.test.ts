/**
 * 会话折叠定义：一次 manim_render 调用怎么折成聊天流里那张卡片。
 *
 * 为什么值得单独测：这里错了的症状是「卡片凭空消失」或「挂到别的调用上」——两种都很难倒查，
 * 而且 fork / 重放是照着会话日志重建卡片的，折错一次就一路错下去。
 * 判据（match / start / update / buildViewNode）都是纯函数，不碰 DOM，可以直接喂事件对象。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { definition, type ManimCardData } from './definition'

/** tool/call：AI 发起一次 manim_render。 */
const callEvent = (over: Record<string, unknown> = {}) => ({
  type: 'tool/call',
  seq: 7,
  data: { name: 'manim_render', arguments: JSON.stringify({ python: 'print(1)' }), callId: 'c1' },
  ...over,
})

/** tool/result：Host 的预检回执落在 message.content 的 text 里。 */
const resultEvent = (text: string, over: Record<string, unknown> = {}) => ({
  type: 'tool/result',
  surfaceOp: 'append',
  data: { message: { source: { callId: 'c1' }, content: [{ type: 'text', text }] } },
  ...over,
})

const state = (over: Partial<ManimCardData> = {}): ManimCardData => ({ python: 'pass', callId: 'c1', ...over })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('match：认领哪些事件', () => {
  it('tool/call 里 name 是 manim_render 才认领，id 带 callId', () => {
    expect(definition.match(callEvent())).toEqual({ id: 'manim-c1', role: 'start' })
  })

  it('别的工具调用不认领（否则每张卡都会挂在别人的调用上）', () => {
    expect(definition.match(callEvent({ data: { name: 'other_tool', callId: 'c9' } }))).toBeNull()
  })

  it('缺 callId 时 id 退化成 manim-，仍认领（否则卡片会整张丢掉）', () => {
    expect(definition.match(callEvent({ data: { name: 'manim_render' } }))).toEqual({
      id: 'manim-',
      role: 'start',
    })
  })

  it('只认同位落盘的 tool/result（surfaceOp=append）', () => {
    expect(definition.match(resultEvent('{"ok":true}'))).toEqual({ id: 'manim-c1', role: 'update' })
  })

  it('替换副本（没有 append）不认领——那是给模型面看的，不进人工转写', () => {
    expect(definition.match(resultEvent('{"ok":true}', { surfaceOp: 'replace' }))).toBeNull()
    expect(definition.match(resultEvent('{"ok":true}', { surfaceOp: undefined }))).toBeNull()
  })

  it('回执缺 callId / callId 为空都不认领（挂不回卡片）', () => {
    expect(definition.match(resultEvent('{"ok":true}', {
      data: { message: { source: {}, content: [{ type: 'text', text: '{}' }] } },
    }))).toBeNull()
    expect(definition.match(resultEvent('{"ok":true}', {
      data: { message: { source: { callId: '' }, content: [{ type: 'text', text: '{}' }] } },
    }))).toBeNull()
  })

  it('其它事件类型一律不认领', () => {
    for (const type of ['message', 'tool/error', 'assistant']) {
      expect(definition.match({ type })).toBeNull()
    }
  })
})

describe('start：从调用参数里取源码', () => {
  const match = (event: unknown) => ({ event, role: 'start' }) as never

  it('取出 python 与 callId', () => {
    expect(definition.start({} as never, match(callEvent()))).toEqual({
      python: 'print(1)',
      callId: 'c1',
      // 事件上没有 location：认不出 step，于是这张卡自成一"批"（键带 callId），序号取事件 seq
      stepKey: 'call:c1',
      seq: 7,
    })
  })

  it('arguments 是坏 JSON 时退回空源码（卡片落到「数据不完整」占位，不炸）', () => {
    const event = callEvent({ data: { name: 'manim_render', arguments: '{不是 JSON', callId: 'c1' } })
    expect(definition.start({} as never, match(event))).toEqual({
      python: '',
      callId: 'c1',
      stepKey: 'call:c1',
      seq: 7,
    })
  })

  it('arguments 解析出来不是对象时也退回空源码', () => {
    for (const raw of ['"x"', '42', 'null', 'true']) {
      const event = callEvent({ data: { name: 'manim_render', arguments: raw, callId: 'c1' } })
      expect(definition.start({} as never, match(event)).python, raw).toBe('')
    }
  })

  it('缺 arguments / python 不是字符串都退回空源码', () => {
    expect(definition.start({} as never, match(callEvent({ data: { name: 'manim_render' } }))).python).toBe('')
    const wrong = callEvent({ data: { name: 'manim_render', arguments: '{"python":42}', callId: 'c1' } })
    expect(definition.start({} as never, match(wrong)).python).toBe('')
  })
})

describe('start：这批卡怎么分批（同一个 step 只真播一张）', () => {
  /** 真事件的 location 长这样：turn 那一层还带序号，step 那一层带 step 号。 */
  const where = (turn: unknown, step: unknown) => ({ kind: 'step', turn: { status: 'open', turn }, step: { step } })
  const start = (location: unknown, callId: string, seq: number) => definition.start({} as never, {
    event: callEvent({ seq, data: { name: 'manim_render', arguments: '{}', callId } }),
    role: 'start',
    location,
  } as never)

  it('同一个 step 里并行发的几张算一批（这就是「只真播一张」的落点）', () => {
    const a = start(where(1, 2), 'call_00_a', 10)
    const b = start(where(1, 2), 'call_01_b', 11)
    const c = start(where(1, 2), 'call_02_c', 12)
    expect([a.stepKey, b.stepKey, c.stepKey]).toEqual(['1:2', '1:2', '1:2'])
    // 同一批里靠 seq 比谁最后到——调度器播的就是 seq 最大那张
    expect([a.seq, b.seq, c.seq]).toEqual([10, 11, 12])
  })

  it('不同 step、不同 turn 各自一批（不能把别的 step 的动画吃掉）', () => {
    expect(start(where(1, 2), 'c1', 1).stepKey).not.toBe(start(where(1, 3), 'c2', 2).stepKey)
    expect(start(where(1, 3), 'c3', 3).stepKey).not.toBe(start(where(2, 3), 'c4', 4).stepKey)
  })

  it('认不出 step（那一层缺席或不是数字）→ 每张自成一批，键带 callId', () => {
    for (const location of [
      undefined,
      {},
      { kind: 'step', turn: { status: 'open', turn: 1 } },
      { kind: 'step', turn: { status: 'open', turn: 1 }, step: {} },
      { kind: 'step', turn: { status: 'open', turn: 1 }, step: { step: '2' } },
    ]) {
      const label = JSON.stringify(location)
      expect(start(location, 'c1', 1).stepKey, label).toBe('call:c1')
      // 关键：不是落回同一个空串——否则这些"认不出"的卡会挤成一批、只播一张
      expect(start(location, 'c2', 2).stepKey, label).toBe('call:c2')
    }
  })

  it('step 在、turn 认不出 → 仍按 step 分批，前缀给个 ? 占位', () => {
    const a = start({ kind: 'step', step: { step: 5 } }, 'c1', 1)
    const b = start({ kind: 'step', step: { step: 5 } }, 'c2', 2)
    expect(a.stepKey).toBe('?:5')
    expect(b.stepKey).toBe(a.stepKey)
  })

  it('seq 缺席或不是安全整数 → 落 0（不让 NaN 混进排序）', () => {
    for (const raw of [undefined, null, '9', 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      const event = callEvent({ seq: undefined, data: { name: 'manim_render', arguments: '{}', callId: 'c1' } })
      if (raw !== undefined) (event as { seq: unknown }).seq = raw
      expect(definition.start({} as never, { event, role: 'start' } as never).seq, String(raw)).toBe(0)
    }
  })
})

describe('update：把预检回执折进来', () => {
  const match = (event: unknown) => ({ event, role: 'update' }) as never

  it('非 tool/result 的事件不改状态', () => {
    const before = state()
    expect(definition.update({ state: before } as never, match(callEvent()))).toBe(before)
  })

  it('ok:true 的回执折成 feedback', () => {
    expect(definition.update({ state: state() } as never, match(resultEvent('{"ok":true}')))).toEqual({
      python: 'pass',
      callId: 'c1',
      feedback: { ok: true },
    })
  })

  it('ok:false 带上 error', () => {
    const next = definition.update(
      { state: state() } as never,
      match(resultEvent('{"ok":false,"error":"第 3 行：NameError"}')),
    )
    expect(next.feedback).toEqual({ ok: false, error: '第 3 行：NameError' })
  })

  it('ok 不是布尔就当没回执（不能把「没回执」当成失败）', () => {
    const before = state()
    expect(definition.update({ state: before } as never, match(resultEvent('{"ok":"yes"}')))).toBe(before)
  })

  it('回执不是 JSON 时打日志并保持原状态', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const before = state()
    expect(definition.update({ state: before } as never, match(resultEvent('not-json')))).toBe(before)
    expect(logged).toHaveBeenCalled()
  })

  it('内容里没有 text 项时也当没回执', () => {
    const before = state()
    const event = resultEvent('', {
      data: { message: { source: { callId: 'c1' }, content: [{ type: 'image' }] } },
    })
    expect(definition.update({ state: before } as never, match(event))).toBe(before)
  })
})

describe('buildViewNode：锚点与数据', () => {
  it('没有 start 时不产出节点（这条调用还没被认领）', () => {
    expect(definition.buildViewNode({ state: state() } as never)).toBeNull()
  })

  it('有 start 时产出带锚点的节点', () => {
    const location = { block: 2 }
    const node = definition.buildViewNode({
      state: state({ python: 'x = 1' }),
      key: 'manim-render',
      id: 'manim-c1',
      start: { event: callEvent(), location },
    } as never)
    expect(node).toMatchObject({
      key: 'manim-render',
      kind: 'manim-render',
      id: 'manim-c1',
      target: 'chat',
      anchorSeq: 7,
      location,
      visibility: 'visible',
      data: { python: 'x = 1' },
    })
  })
})

describe('live：这张卡是不是刚生成出来的', () => {
  // 每个用例换一个 callId：`bornLive` 是模块级、跨用例共享的（它就是「这一页的真相」），
  // 共用一个 id 会让「先看过 open」从上一个用例漏到下一个用例里。
  let n = 0
  const at = (location: unknown, callId = `live-${++n}`) => ({
    event: callEvent({ data: { name: 'manim_render', arguments: '{}', callId } }),
    role: 'start',
    location,
  }) as never
  const open = { kind: 'step', turn: { status: 'open' }, step: {} }
  const closed = { kind: 'step', turn: { status: 'closed' }, step: {} }

  it('收录时所在那一轮还开着 → live（只有这种卡会被自动播一次）', () => {
    expect(definition.start({} as never, at({ kind: 'turn', turn: { status: 'open' } })).live).toBe(true)
    // 调用落在 step 上：location 是 step 级，但 turn 那一层照样在
    expect(definition.start({} as never, at(open)).live).toBe(true)
  })

  it('那一轮已经关了 → 不置位（老会话回填，一律落末帧）', () => {
    expect(definition.start({} as never, at({ kind: 'turn', turn: { status: 'closed' } })).live).toBeUndefined()
  })

  it('location 缺席 / 形状没见过的 → 不置位（宁可静态，也不要乱播一遍）', () => {
    for (const location of [undefined, {}, { kind: 'session' }, { kind: 'turn' }, { kind: 'turn', turn: {} }, 42, 'open']) {
      expect(definition.start({} as never, at(location)).live, JSON.stringify(location)).toBeUndefined()
    }
  })

  /**
   * 这条是「第一张卡莫名其妙跳到末帧」的回归线。
   *
   * 引擎会在流式过程中反复重放 start()（实测同一张卡跑 5 次），最后一次发生在 `turn/end` 之后，
   * location 那时已经变成 closed。若每次现算，「这张卡算不算刚生成」就取决于**它什么时候被挂载**，
   * 同一张卡会有时正常播、有时直接落末帧。所以口径是：见过 open 就一直算。
   */
  it('同一张卡先看到 open、重放时变成 closed —— 仍算刚生成', () => {
    const callId = 'live-flip'
    expect(definition.start({} as never, at(open, callId)).live).toBe(true)
    expect(definition.start({} as never, at(closed, callId)).live).toBe(true)
    expect(definition.start({} as never, at(closed, callId)).live).toBe(true)
  })

  it('从没见过 open 的卡，重放多少次都不会变成 live', () => {
    const callId = 'live-never'
    expect(definition.start({} as never, at(closed, callId)).live).toBeUndefined()
    expect(definition.start({} as never, at(closed, callId)).live).toBeUndefined()
  })
})

describe('interrupted：宿主说这次没跑成', () => {
  const match = (event: unknown) => ({ event, role: 'update' }) as never
  /** 中断时落进日志的是宿主文案 + isError，不是我们那套 {ok} 回执。 */
  const aborted = (text: string) => ({
    type: 'tool/result',
    surfaceOp: 'append',
    data: {
      message: { source: { callId: 'c1' }, content: [{ type: 'text', text }], isError: true },
    },
  })

  it('isError 且回执读不成 json → 标成 interrupted（卡片不再当它跑成了）', () => {
    expect(definition.update({ state: state() } as never, match(aborted('Error: tool call aborted'))))
      .toMatchObject({ interrupted: true })
    expect(definition.update({ state: state() } as never, match(aborted('Error: tool call aborted before dispatch'))))
      .toMatchObject({ interrupted: true })
  })

  it('预检不通过是我们自己的回执（读得出 ok:false）→ 不算中断，走 rejected 那条路', () => {
    const event = aborted('{"ok":false,"error":"第 3 行：NameError"}')
    const next = definition.update({ state: state() } as never, match(event))
    expect(next.feedback).toEqual({ ok: false, error: '第 3 行：NameError' })
    expect(next.interrupted).toBeUndefined()
  })

  it('没有 isError 的怪回执不标中断（宁可不动，也不要瞎认）', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}) // 这条回执本来就会被记一条日志
    const event = resultEvent('Error: something odd')
    const before = state()
    expect(definition.update({ state: before } as never, match(event))).toBe(before)
  })

  it('已经带 interrupted 的卡再收一条回执：回执归回执，不把中断擦掉', () => {
    const before = state({ interrupted: true })
    const next = definition.update({ state: before } as never, match(resultEvent('{"ok":true}')))
    expect(next).toEqual({ python: 'pass', callId: 'c1', interrupted: true, feedback: { ok: true } })
  })
})
