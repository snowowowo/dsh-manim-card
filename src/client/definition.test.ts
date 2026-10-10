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
    expect(definition.start({} as never, match(callEvent()))).toEqual({ python: 'print(1)', callId: 'c1' })
  })

  it('arguments 是坏 JSON 时退回空源码（卡片落到「数据不完整」占位，不炸）', () => {
    const event = callEvent({ data: { name: 'manim_render', arguments: '{不是 JSON', callId: 'c1' } })
    expect(definition.start({} as never, match(event))).toEqual({ python: '', callId: 'c1' })
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
