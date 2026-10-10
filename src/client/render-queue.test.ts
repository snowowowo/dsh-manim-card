/**
 * 渲染调度器的回归网。
 *
 * 这里钉的是**判据本身**：谁先跑、谁被推迟、谁被收掉。调度器刻意做成不碰 DOM、时间可注入，
 * 就是为了这些能直接断言——不然「预热窗口对不对」「优先级对不对」只能靠跑界面肉眼看，
 * 而这种东西一眼看不出对错（都得上下滚半天才知道）。
 */
import { describe, expect, it } from 'vitest'
import { RenderQueue, type CardHooks, type CardState, type QueueCard } from './render-queue.ts'

/** 手动时钟 + 手动定时器：`flush()` 把排到的定时器跑掉，`advance()` 推进时间。 */
function rig(options: { window?: number; cap?: number; settleMs?: number } = {}) {
  let clock = 0
  let queue: (() => void)[] = []
  const queue_ = new RenderQueue({
    ...options,
    now: () => clock,
    setTimer: (callback) => { queue.push(callback); return callback },
  })
  const flush = (): void => {
    for (let guard = 0; guard < 50 && queue.length > 0; guard++) {
      const pending = queue
      queue = []
      for (const callback of pending) callback()
    }
  }
  const advance = (ms: number): void => { clock += ms }
  return { queue: queue_, flush, advance }
}

/** 登记一张卡，把「跑过几次」记下来；返回放行用的 release 与状态更新口。 */
function card(id: string, seq: number, stepKey: string, extra: Partial<CardState> = {}) {
  const runs: { release: (hasCanvas: boolean) => void }[] = []
  let evicted = 0
  const hooks: CardHooks = {
    run: (release) => {
      runs.push({
        // 忘了传参的写法（`release()`）会静悄悄把「有没有画布」算成 nullish，配额就跟着歪了
        // ——这坑真踩过一次，所以让它当场响，不要留在断言里慢慢猜。
        release: (hasCanvas) => {
          if (typeof hasCanvas !== 'boolean') throw new Error('release 必须明说手里有没有画布')
          release(hasCanvas)
        },
      })
    },
    evict: () => { evicted += 1 },
  }
  const identity: QueueCard = { callId: id, seq, stepKey }
  const state: CardState = { visible: false, willing: true, hasCanvas: false, ...extra }
  return { identity, state, hooks, runs, evicted: () => evicted, get evictedCount() { return evicted } }
}

describe('预热窗口：离阅读位置最近的几张才会跑，其余推迟', () => {
  it('一张都不可见 → 谁也不跑（用户没在看，就别烧算力）', () => {
    const { queue, flush } = rig()
    const cards = Array.from({ length: 10 }, (_, i) => card(`c${i}`, i, `s${i}`))
    for (const c of cards) queue.register(c.identity, c.state, c.hooks)
    flush()
    expect(queue.active).toBeNull()
    expect(cards.every((c) => c.runs.length === 0)).toBe(true)
  })

  it('可见的卡一定跑（用户正看着，没资格等）', () => {
    const { queue, flush, advance } = rig({ settleMs: 0 })
    const cards = Array.from({ length: 20 }, (_, i) => card(`c${i}`, i, `s${i}`))
    for (const c of cards) queue.register(c.identity, c.state, c.hooks)
    queue.update('c15', { visible: true })
    advance(1000)
    flush()
    expect(queue.active).toBe('c15')
  })

  it('窗口只有 6 张：离得远的一张都不动', () => {
    const { queue, flush, advance } = rig({ settleMs: 0 })
    const cards = Array.from({ length: 30 }, (_, i) => card(`c${i}`, i, `s${i}`))
    for (const c of cards) queue.register(c.identity, c.state, c.hooks)
    queue.update('c20', { visible: true })
    advance(1000)
    flush()

    const order: string[] = []
    for (let step = 0; step < 8; step++) {
      const active = queue.active
      if (active === null) break
      order.push(active)
      const picked = cards.find((c) => c.identity.callId === active)
      picked?.runs.at(-1)?.release(true)
      flush()
    }
    // 只有 c20 自己 + 离它最近的 5 张，离得远的一张都不该进来
    expect(order[0]).toBe('c20')
    expect(new Set(order)).toEqual(new Set(['c20', 'c19', 'c21', 'c18', 'c22', 'c17']))
    expect(cards[0].runs.length, 'c0 离着 20 张，不该被预热').toBe(0)
  })

  it('窗口按位置算，不随「跑没跑过」往外滑', () => {
    // 早先的写法是「取离阅读位置最近的 6 张**还没渲染的**」——一渲染就从候选里掉出去，
    // 窗口跟着外扩，一路把整条会话全预热了。这里钉住：跑完之后窗口里不再冒新的。
    const { queue, flush, advance } = rig({ settleMs: 0 })
    const cards = Array.from({ length: 30 }, (_, i) => card(`c${i}`, i, `s${i}`))
    for (const c of cards) queue.register(c.identity, c.state, c.hooks)
    queue.update('c20', { visible: true })
    advance(1000)
    flush()

    const order: string[] = []
    for (let step = 0; step < 30; step++) {
      const active = queue.active
      if (active === null) break
      order.push(active)
      cards.find((c) => c.identity.callId === active)?.runs.at(-1)?.release(true)
      flush()
    }
    expect(order.length, '一屏就 6 张，跑完就该停').toBe(6)
  })

  it('可见的绝对优先：哪怕它离阅读位置远', () => {
    const { queue, flush, advance } = rig({ settleMs: 0 })
    const cards = Array.from({ length: 12 }, (_, i) => card(`c${i}`, i, `s${i}`))
    for (const c of cards) queue.register(c.identity, c.state, c.hooks)
    queue.update('c5', { visible: true })
    queue.update('c9', { visible: true })
    advance(1000)
    flush()
    // 阅读位置 = 第一张可见的 c5；两张都可见 → 先近的 c5
    expect(queue.active).toBe('c5')
  })
})

describe('串行：一次只发一个许可', () => {
  it('不 release 就不发下一个', () => {
    const { queue, flush, advance } = rig({ settleMs: 0 })
    const a = card('a', 0, 's0', { visible: true })
    const b = card('b', 1, 's1', { visible: true })
    queue.register(a.identity, a.state, a.hooks)
    queue.register(b.identity, b.state, b.hooks)
    advance(1000)
    flush()
    expect(a.runs.length).toBe(1)
    expect(b.runs.length, 'a 还没跑完，b 不该拿到许可').toBe(0)

    a.runs[0].release(true)
    flush()
    expect(b.runs.length).toBe(1)
  })

  it('release 之后那张算「有画布了」，不再排队', () => {
    const { queue, flush, advance } = rig({ settleMs: 0 })
    const a = card('a', 0, 's0', { visible: true })
    queue.register(a.identity, a.state, a.hooks)
    advance(1000)
    flush()
    a.runs[0].release(true)
    flush()
    expect(queue.inspect('a')?.hasCanvas).toBe(true)
    expect(queue.active).toBeNull()
  })

  it('release 调两次不会把队列带歪', () => {
    const { queue, flush, advance } = rig({ settleMs: 0 })
    const a = card('a', 0, 's0', { visible: true })
    const b = card('b', 1, 's1', { visible: true })
    queue.register(a.identity, a.state, a.hooks)
    queue.register(b.identity, b.state, b.hooks)
    advance(1000)
    flush()
    a.runs[0].release(true)
    a.runs[0].release(true)
    flush()
    expect(b.runs.length).toBe(1)
  })

  /**
   * 这一条是回归线：跑的过程中用户按了 ⏩ /「手动播放」，那一趟被当场作废、画布也收了。
   * 若 `release()` 默认按「有画布」记账，那张卡就再也不排队了——台上留一块空白加骨架屏，
   * 按什么都没反应。
   */
  it('release 报「手里没画布」→ 不算有画布，重新排队', () => {
    const { queue, flush, advance } = rig({ settleMs: 0 })
    const a = card('a', 0, 's0', { visible: true })
    queue.register(a.identity, a.state, a.hooks)
    advance(1000)
    flush()
    expect(queue.active).toBe('a')

    a.runs[0].release(false)
    flush()
    expect(queue.inspect('a')?.hasCanvas, '画布收掉了，不能当它有').toBe(false)
    expect(a.runs.length, '于是它重新拿到许可').toBe(2)
  })

  it('那一趟没留下画布，就不去收别人的画布（手里没东西可收）', () => {
    const { queue, flush, advance } = rig({ cap: 1, settleMs: 0 })
    const a = card('a', 0, 's0', { visible: true })
    const b = card('b', 1, 's1')
    const c = card('c', 2, 's2')
    for (const one of [a, b, c]) queue.register(one.identity, one.state, one.hooks)
    // b / c 已经占着两个名额（超了 cap=1），a 还没渲
    for (const id of ['b', 'c']) queue.update(id, { hasCanvas: true })
    advance(1000)
    flush()
    expect(queue.active).toBe('a')

    a.runs[0].release(false)
    flush()
    expect(b.evictedCount + c.evictedCount, '这一趟没能把谁挤出去，就别乱收').toBe(0)
  })
})

describe('同一批只播一张：isBatchTail', () => {
  it('单个 step 就是自己当代表', () => {
    const { queue } = rig()
    const a = card('a', 0, 's0')
    queue.register(a.identity, a.state, a.hooks)
    expect(queue.isBatchTail('a')).toBe(true)
  })

  it('同一 step 里取 seq 最大的那张（轨迹里的 call_00_ / call_01_ / call_02_）', () => {
    const { queue } = rig()
    const first = card('a', 27, '1:2')
    const second = card('b', 29, '1:2')
    const third = card('c', 31, '1:2')
    for (const c of [first, second, third]) queue.register(c.identity, c.state, c.hooks)
    expect(queue.isBatchTail('a')).toBe(false)
    expect(queue.isBatchTail('b')).toBe(false)
    expect(queue.isBatchTail('c'), '最后到的那张当代表').toBe(true)
  })

  it('代表不成立（被拒 / 被中断）时让给兄弟卡', () => {
    const { queue } = rig()
    const first = card('a', 27, '1:2')
    const second = card('b', 29, '1:2')
    queue.register(first.identity, first.state, first.hooks)
    queue.register(second.identity, second.state, second.hooks)
    queue.update('b', { willing: false })
    expect(queue.isBatchTail('a'), 'b 不能跑，代表回到 a').toBe(true)
    expect(queue.isBatchTail('b')).toBe(false)
  })

  it('不同 step 互不影响', () => {
    const { queue } = rig()
    const a = card('a', 27, '1:2')
    const b = card('b', 29, '1:3')
    queue.register(a.identity, a.state, a.hooks)
    queue.register(b.identity, b.state, b.hooks)
    expect(queue.isBatchTail('a')).toBe(true)
    expect(queue.isBatchTail('b')).toBe(true)
  })

  it('没登记过的卡不问自明地不是代表', () => {
    const { queue } = rig()
    expect(queue.isBatchTail('nope')).toBe(false)
  })
})

describe('一批的静默期：等兄弟卡到齐再发许可', () => {
  it('刚登记就排到，也要等静默期过去', () => {
    const { queue, flush, advance } = rig({ settleMs: 120 })
    const a = card('a', 27, '1:2', { visible: true })
    queue.register(a.identity, a.state, a.hooks)
    flush()
    expect(a.runs.length, '静默期没过，先别跑').toBe(0)

    advance(200)
    flush()
    expect(a.runs.length).toBe(1)
  })

  it('静默期内又来一张，计时重来——这样代表才判得准', () => {
    const { queue, flush, advance } = rig({ settleMs: 120 })
    const a = card('a', 27, '1:2', { visible: true })
    queue.register(a.identity, a.state, a.hooks)
    advance(80)
    const b = card('b', 29, '1:2', { visible: true })
    queue.register(b.identity, b.state, b.hooks)
    advance(80)
    flush()
    expect(a.runs.length + b.runs.length, 'b 刚来 80ms，还没安静下来').toBe(0)

    advance(200)
    flush()
    expect(queue.isBatchTail('b')).toBe(true)
    expect(b.runs.length, '轮到的是代表').toBe(1)
    expect(a.runs.length).toBe(0)
  })
})

describe('画布上限：超编收掉离阅读位置最远的', () => {
  it('超编才收，刚跑完那张留着，先收更旧更远的', () => {
    const { queue, flush, advance } = rig({ cap: 2, settleMs: 0 })
    const cards = Array.from({ length: 5 }, (_, i) => card(`c${i}`, i, `s${i}`))
    for (const c of cards) queue.register(c.identity, c.state, c.hooks)
    // c1 / c2 / c3 已经渲过（占着 3 个名额，超了 cap=2），c0 可见、还没渲
    for (const id of ['c1', 'c2', 'c3']) queue.update(id, { hasCanvas: true })
    queue.update('c0', { visible: true })
    advance(1000)
    flush()
    expect(queue.active).toBe('c0')

    cards[0].runs[0].release(true)
    flush()
    const holding = cards
      .filter((c) => queue.inspect(c.identity.callId)?.hasCanvas === true)
      .map((c) => c.identity.callId)
    expect(holding.length, '上限就是 2').toBeLessThanOrEqual(2)
    expect(holding, '刚跑完的 c0 留着').toContain('c0')
    expect(cards[3].evictedCount, '最远的 c3 被收了').toBeGreaterThan(0)
  })

  it('没超编一张都不收（滚出去也不拆，就是这条）', () => {
    const { queue, flush, advance } = rig({ cap: 8, settleMs: 0 })
    const cards = Array.from({ length: 6 }, (_, i) => card(`c${i}`, i, `s${i}`))
    for (const c of cards) queue.register(c.identity, c.state, c.hooks)
    queue.update('c3', { visible: true })
    advance(1000)
    flush()
    for (let step = 0; step < 6; step++) {
      const active = queue.active
      if (active === null) break
      cards.find((c) => c.identity.callId === active)?.runs.at(-1)?.release(true)
      flush()
    }
    expect(cards.reduce((sum, c) => sum + c.evictedCount, 0), '6 张 < 上限 8').toBe(0)
    expect(cards.every((c) => queue.inspect(c.identity.callId)?.hasCanvas === true)).toBe(true)
  })
})

describe('注销', () => {
  it('注销之后不再参与排队，也不再是代表', () => {
    const { queue, flush, advance } = rig({ settleMs: 0 })
    const a = card('a', 27, '1:2', { visible: true })
    const b = card('b', 29, '1:2')
    queue.register(a.identity, a.state, a.hooks)
    queue.register(b.identity, b.state, b.hooks)
    a.hooks.run(() => {}) // 拿走许可，模拟正在跑
    queue.unregister('b')
    flush()
    expect(queue.size).toBe(1)
    expect(queue.isBatchTail('b')).toBe(false)
    expect(queue.isBatchTail('a'), '兄弟走了，a 又成了代表').toBe(true)
  })

  it('正在跑的那张被注销 → 队列不会卡死', () => {
    const { queue, flush, advance } = rig({ settleMs: 0 })
    const a = card('a', 0, 's0', { visible: true })
    const b = card('b', 1, 's1', { visible: true })
    queue.register(a.identity, a.state, a.hooks)
    queue.register(b.identity, b.state, b.hooks)
    advance(1000)
    flush()
    expect(queue.active).toBe('a')
    queue.unregister('a')
    flush()
    expect(queue.active, '注销把 running 让出来了').toBe('b')
  })
})
