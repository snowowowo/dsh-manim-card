/**
 * 渲染调度：决定「现在轮到哪张卡跑」，并管住同时活着的画布数量。
 *
 * 为什么需要它——三件事各自都要**跨卡**的信息，单张卡自己判不了：
 *
 * 1) **预热范围**。用户定的口径是「从阅读位置往上下扩散、总共 6 张」。而「阅读位置」是整页的
 *    概念（哪张卡正在被看），单张卡只知道自己在不在视口里。于是这里收下所有已挂载的卡、按事件
 *    顺序排好，拿**第一张可见的卡**当阅读位置，离它最近的 6 张（外加所有可见的）才有资格跑；
 *    其余一律**推迟到用户滚过去再跑**——既不白烧算力，也不会让人看到一堆离得远的动画在演。
 *
 * 2) **优先级**。全页只有一份 Python 解释器（见 `core/py/runtime.ts` 的队列），所以渲染天生
 *    串行；真正要定的是**谁先**。不加优先级的话，一次预热 6 张时刚生成的那张会排在后头，
 *    用户盯着骨架屏等——而他的视线恰恰就在那张新卡上。所以：**可见的绝对优先，其次按离阅读
 *    位置的距离**。（「刚生成」不用单独一档：聊天跟随尾部，新卡一出现就是可见的、也就是最近的。）
 *
 * 3) **画布上限**。一张卡一块 WebGL 上下文，而浏览器活跃上下文有上限（超了强制丢弃最老的，
 *    那块画布直接变黑）。所以「滚出视口不拆」必须配一个上限：超了就把**离阅读位置最远**的收掉；
 *    那张卡回到「还没渲染」，滚回来会重跑一次（极速落末帧 + 骨架屏，见 card.tsx）。
 *
 * 这里**不管渲染本身**——建画布、跑 Python、拆画布都是卡自己的事；调度器只发「许可」，
 * 一次只发一个，拿到许可的卡跑完必须 `release()`，否则整条队列停在那儿。
 *
 * 时间与阈值都可注入：这里的判据（谁先、谁被收）是纯逻辑，必须能被单测直接钉住，
 * 不该靠「跑一遍界面看看」来验。
 */

/** 阅读位置上下扩散几张。用户口径：总共 6 张。 */
const WINDOW = 6
/**
 * 同时活着的画布上限。比预热窗口略大：正好等于窗口的话，刚滚回来那张可能立刻被收掉，
 * 反而闪一下。8 给手动滚动留了余量。
 */
const CANVAS_CAP = 8
/**
 * 同一批（同一个 step）的**静默期**：这段时间内还有新卡登记，就先别发许可。
 *
 * 为什么需要：一次 `manim_card` 之外，模型会在同一个 step 里并行发好几个（轨迹里见过 3 个，
 * 形如 `call_00_` / `call_01_` / `call_02_`）。而「一个 step 只真播一张」要靠**谁是最后一个**
 * 判——早到的那张若在兄弟卡挂载之前就开跑，就会多播一段。所以等这批安静下来再发。
 */
const BATCH_SETTLE_MS = 120

/** 一张卡报上来的身份。 */
export interface QueueCard {
  callId: string
  /** 事件序号（`tool/call` 的 seq）：定先后用，新的在后。 */
  seq: number
  /** 同一批（同一个 step）的标识，形如 `1:2`。一个 step 只真播一张，见 `isBatchTail`。 */
  stepKey: string
}

/** 一张卡报上来的状态（会变，每次变都 `update` 一次）。 */
export interface CardState {
  /** 在视口里（含 rootMargin 那一圈）。 */
  visible: boolean
  /** 这张卡允许被渲染：代码合法、没被中断挡住。false = 别排队。 */
  willing: boolean
  /** 现在有画布吗（跑完或跑着都算）。false 的卡才排队等许可。 */
  hasCanvas: boolean
}

/** 卡交给调度器的两个动作。 */
export interface CardHooks {
  /**
   * 轮到这张卡了。**跑完必须调 `release()`**，否则整条队列停在这儿。
   *
   * `release` 要带上「跑完的时候手里还有画布吗」。为什么不能默认「有」：跑的过程中用户可能
   * 按了 ⏩ 或「手动播放」，那一趟被当场作废、画布也收了——这时若仍记成「有画布」，
   * 这张卡就再也不排队了，台上留着一块空白加骨架屏。顺着 `release(false)` 它才会重新入队。
   */
  run: (release: (hasCanvas: boolean) => void) => void
  /** 画布超编了，把这张的收掉——收掉之后它会被当成「还没渲染」。 */
  evict: () => void
}

export interface RenderQueueOptions {
  /** 预热窗口（默认 6）。 */
  window?: number
  /** 同时活着的画布上限（默认 8）。 */
  cap?: number
  /** 同一批的静默期毫秒（默认 120）。 */
  settleMs?: number
  /** 取当前时间（测试注入假时钟）。 */
  now?: () => number
  /** 定时器（测试注入，免得真等）。 */
  setTimer?: (callback: () => void, ms: number) => unknown
}

interface Entry {
  card: QueueCard
  state: CardState
  hooks: CardHooks
}

interface Candidate {
  id: string
  distance: number
  visible: boolean
  /** 这一类里它是不是「代表」——同一个 step 里排最后的那个（见 isBatchTail）。 */
  tail: boolean
}

export class RenderQueue {
  private readonly entries = new Map<string, Entry>()
  /** callId 按 seq 升序排好——「阅读位置」「距离」都以此为坐标。 */
  private order: string[] = []
  private running: string | null = null
  /** stepKey → 最后一次登记的墙钟时间：静默期判据。 */
  private readonly touched = new Map<string, number>()
  private timer: unknown = null

  private readonly window: number
  private readonly cap: number
  private readonly settleMs: number
  private readonly now: () => number
  private readonly setTimer: (callback: () => void, ms: number) => unknown

  constructor(options: RenderQueueOptions = {}) {
    this.window = options.window ?? WINDOW
    this.cap = options.cap ?? CANVAS_CAP
    this.settleMs = options.settleMs ?? BATCH_SETTLE_MS
    this.now = options.now ?? (() => Date.now())
    this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms))
  }

  /** 登记一张卡（挂载时）。`visible` 由调用方的 IntersectionObserver 随后报上来。 */
  register(card: QueueCard, state: CardState, hooks: CardHooks): void {
    this.entries.set(card.callId, { card, state: { ...state }, hooks })
    const at = this.order.findIndex((id) => {
      const entry = this.entries.get(id)
      return entry === undefined || entry.card.seq > card.seq
    })
    if (at < 0) this.order.push(card.callId)
    else this.order.splice(at, 0, card.callId)
    this.touched.set(card.stepKey, this.now())
    this.schedule()
  }

  /** 注销一张卡（卸载时）。正在跑的那张交给它的 `release()` 收尾，这里不越权。 */
  unregister(callId: string): void {
    this.entries.delete(callId)
    this.order = this.order.filter((id) => id !== callId)
    if (this.running === callId) this.running = null
    this.schedule()
  }

  /** 报一次状态变化。 */
  update(callId: string, patch: Partial<CardState>): void {
    const entry = this.entries.get(callId)
    if (entry === undefined) return
    Object.assign(entry.state, patch)
    this.schedule()
  }

  /**
   * 同一批里排在最后的那张（= 这一批的**代表**，由它真播）。
   *
   * 为什么只播一张：一次来 2~3 张时，用户等的其实是结果，不是 2~3 段动画接连演完
   * （那要 6~9 秒，后几张全程骨架屏）。这跟「一条会话里连着好几张卡时只播刚生成的那张」
   * 是同一条原则，只是粒度从「会话」收到「一批」。想看其余的点「手动播放」。
   *
   * 为什么取**最后**一张而不是第一张：聊天跟随尾部，新内容从下面进来，用户的视线就在最下面
   * 那张上——让离视线最近的那张负责真播，跟上面第 1 条是同一个道理。
   */
  isBatchTail(callId: string): boolean {
    const mine = this.entries.get(callId)
    if (mine === undefined) return false
    return this.tailSeqs().get(mine.card.stepKey) === mine.card.seq
  }

  /** 当前正在跑的是哪张（没人跑就是 null）。 */
  get active(): string | null {
    return this.running
  }

  /** 已经登记的张数（调试与测试用）。 */
  get size(): number {
    return this.entries.size
  }

  /** 这张卡在调度器眼里现在什么状态（调试与测试用——登记时状态是**拷贝**进去的）。 */
  inspect(callId: string): Readonly<CardState> | undefined {
    const entry = this.entries.get(callId)
    return entry === undefined ? undefined : { ...entry.state }
  }

  /** 按优先级排出「现在可以跑」的卡；`[0]` 就是下一个。 */
  private eligible(): string[] {
    const reading = this.readingIndex()
    if (reading < 0) return []
    const tails = this.tailSeqs()
    const inWindow = this.windowIds(reading)
    const candidates: Candidate[] = []
    this.order.forEach((id, index) => {
      const entry = this.entries.get(id)
      if (entry === undefined || entry.state.hasCanvas || !entry.state.willing) return
      const visible = entry.state.visible
      if (!visible && !inWindow.has(id)) return
      candidates.push({
        id,
        visible,
        distance: Math.abs(index - reading),
        tail: tails.get(entry.card.stepKey) === entry.card.seq,
      })
    })
    return candidates.sort((a, b) => this.byPriority(a, b)).map((candidate) => candidate.id)
  }

  /**
   * 以阅读位置为锚、向上下摊开的 `window` 个**下标**。
   *
   * 注意这里只按**位置**算，与「跑没跑过」无关——早先按「还没渲染的候选」算，结果一渲染就
   * 从候选里掉出去，窗口跟着往外滑，一路把整条会话全预热了（单测里一眼看出来：本该 6 张，
   * 实际 9 张还停不下来）。
   *
   * 摊法是交替向上向下（0、上1、下1、上2、下2…），越界就跳过——于是贴底时自然全往上扩散、
   * 贴顶时全往下扩散、在中间就上下平均，正好是用户要的形状。
   */
  private windowIds(reading: number): Set<string> {
    const ids = new Set<string>()
    for (let step = 0; ids.size < this.window && step < this.order.length; step++) {
      const offset = step === 0 ? 0 : (step % 2 === 1 ? -Math.ceil(step / 2) : Math.ceil(step / 2))
      const id = this.order[reading + offset]
      if (id !== undefined) ids.add(id)
    }
    return ids
  }

  /** 每个 step 里 willing 的最大 seq（代表是谁）。 */
  private tailSeqs(): Map<string, number> {
    const tails = new Map<string, number>()
    for (const entry of this.entries.values()) {
      if (!entry.state.willing) continue
      const best = tails.get(entry.card.stepKey)
      if (best === undefined || entry.card.seq > best) tails.set(entry.card.stepKey, entry.card.seq)
    }
    return tails
  }

  private byPriority(a: Candidate, b: Candidate): number {
    // 可见的先跑：用户正看着，没资格等。
    if (a.visible !== b.visible) return a.visible ? -1 : 1
    // 其次是「代表」：同一批里只有它真播，先让它动起来，用户等的就是这段动画。
    if (a.tail !== b.tail) return a.tail ? -1 : 1
    if (a.distance !== b.distance) return a.distance - b.distance
    // 同距离时新的先跑：用户视线通常压在下沿。
    return this.seqOf(b.id) - this.seqOf(a.id)
  }

  private seqOf(callId: string): number {
    return this.entries.get(callId)?.card.seq ?? 0
  }

  /** 阅读位置 = 第一张可见的卡在队列里的下标；一张都不可见就是 -1（谁也不跑）。 */
  private readingIndex(): number {
    return this.order.findIndex((id) => this.entries.get(id)?.state.visible === true)
  }

  /** 排一次队。永远走定时器——好让同一批的兄弟卡先登记完（见 BATCH_SETTLE_MS）。 */
  private schedule(): void {
    if (this.timer !== null) return
    this.timer = this.setTimer(() => {
      this.timer = null
      this.pump()
    }, 0)
  }

  private pump(): void {
    if (this.running !== null) return
    const next = this.eligible()[0]
    if (next === undefined) return
    // 同一批还没安静下来就先别发：早到的那张得等兄弟卡到齐，才判得出谁是代表（见 isBatchTail）。
    const entry = this.entries.get(next)
    if (entry !== undefined && this.now() - (this.touched.get(entry.card.stepKey) ?? 0) < this.settleMs) {
      this.schedule()
      return
    }
    this.running = next
    let released = false
    entry?.hooks.run((hasCanvas: boolean) => {
      if (released) return
      released = true
      this.running = null
      const holder = this.entries.get(next)
      // 卡在跑的过程里可能已经卸载了：那就别把画布算在它头上。
      if (holder !== undefined) holder.state.hasCanvas = hasCanvas
      // 手里没画布就没什么可收的，不必白走一趟（fresh 的豁免也没了对象）。
      if (hasCanvas) this.enforceCap(next)
      this.schedule()
    })
  }

  /**
   * 画布超编就把离阅读位置最远的收掉——收掉的卡回到「还没渲染」。
   *
   * `fresh`（刚放行的那张）不参与本轮：它是刚花时间渲出来的、也是最可能正被看着的一张，
   * 收它等于白跑一趟，还会当着用户的面闪一下。真需要收时先收更旧的那些，下一轮再说它。
   *
   * 只管 `fresh` 一条豁免：`enforceCap` 只在「一张刚跑完」这一刻被调用，那会儿没人正在跑，
   * 所以不必再判 running（多一条判不到的分支，只会让人以为它拦得住什么）。
   */
  private enforceCap(fresh: string): void {
    const holding = this.order.filter((id) => this.entries.get(id)?.state.hasCanvas === true)
    if (holding.length <= this.cap) return
    const reading = Math.max(this.readingIndex(), 0)
    const victims = holding
      .map((id) => ({ id, distance: Math.abs(this.order.indexOf(id) - reading) }))
      .sort((a, b) => b.distance - a.distance || this.seqOf(a.id) - this.seqOf(b.id))
    let quota = holding.length - this.cap
    for (const victim of victims) {
      if (quota <= 0) break
      if (victim.id === fresh) continue
      const entry = this.entries.get(victim.id)
      if (entry === undefined) continue
      entry.state.hasCanvas = false
      quota -= 1
      entry.hooks.evict()
    }
  }
}

/** 全页一份（每一侧只有一块聊天流）。 */
export const renderQueue = new RenderQueue()
