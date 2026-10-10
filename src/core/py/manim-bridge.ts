/**
 * 桥的真实现：把 manim 适配层发来的动作落到 manim-web 的真对象上。
 *
 * 输入是一块**已建好的 manim-web Scene**（建场景要碰 DOM/WebGL，属于 Client 半边的事），
 * 本模块只做「句柄 ↔ 对象」的登记与转发，不碰 DOM，因此可在 Node 里对真 manim-web 做单测。
 *
 * 「这个写法支不支持」一律问 `surface.ts`（支持面 SSOT）——名字、构造参数形状、animate 白名单都在那儿，
 * 预检（`dry-run-bridge.ts`）取的是同一份判定。本模块只管**执行期**的事：句柄解析、真对象构造与调用。
 */
import {
  ANIM_CLASS_KEY,
  ANIMATE_KIND,
  GROUP_KEY,
  HANDLE_KEY,
  SPEED_KEY,
  type AnimationSpec,
  type AnimationTarget,
  type ManimBridge,
} from './bridge.ts'
import { healSubpathBookkeeping, subpathTreeConsistent } from './subpath-bookkeeping.ts'
import {
  angleFromPoints,
  animateCallArgs,
  arcBetweenPoints,
  ARC_SHAPE_REPAIRS,
  ANGLE_POINTS_REBUILT,
  camelKeys,
  planAnimate,
  planAnimation,
  planAttrRead,
  planCreate,
  planMethod,
  planPlayOptions,
  PY_API_MAP,
  type RatePlan,
} from './surface.ts'

export interface ManimNamespace {
  Mobject: new (...args: unknown[]) => object
  /** 「点数对齐」型动画要看两端是不是 VGroup（VGroup 对走按子物配对，与点数无关）。 */
  VGroup: new (...args: unknown[]) => object
  [name: string]: unknown
}

export interface ManimWebBridgeOptions {
  manim: ManimNamespace
  /** 已建好的 manim-web Scene 实例；适配层里的 Scene() 会绑到它。 */
  scene: object
  /**
   * 极速：不等时间，直接落到终态。实验场「全部渲染」要跑上百条语料，
   * 按 `run_time` / `wait` 真等一遍要几分钟（一条 `wait(4.4)` 就 4.4 秒）。
   */
  fast?: boolean
}

/** Python 的 _zip / VGroup 等传入的物体是 `{ __handle: n }`，这里换回真对象。 */
type HandleTag = { [HANDLE_KEY]: number }

const isHandleTag = (value: unknown): value is HandleTag =>
  value !== null && typeof value === 'object' && HANDLE_KEY in (value as Record<string, unknown>)

/** 组动画标记：`{ __animations: [spec…] }`——位置参数里的普通数组是向量，不能混。 */
type GroupTag = { [GROUP_KEY]: AnimationSpec[] }

const isGroupTag = (value: unknown): value is GroupTag =>
  value !== null && typeof value === 'object' && GROUP_KEY in (value as Record<string, unknown>)

/** 动画类名标记：`{ __animClass: "FadeIn" }`——LaggedStartMap 的第一参（类只能按名字过桥）。 */
type AnimClassTag = { [ANIM_CLASS_KEY]: string }

const isAnimClassTag = (value: unknown): value is AnimClassTag =>
  value !== null && typeof value === 'object' && ANIM_CLASS_KEY in (value as Record<string, unknown>)

/** 恒定速度函数标记：`{ __speedFactor: 2 }`——桥侧换成 `() => 2`（见 ChangeSpeed 的改写）。 */
type SpeedTag = { [SPEED_KEY]: number }

const isSpeedTag = (value: unknown): value is SpeedTag =>
  value !== null && typeof value === 'object' && SPEED_KEY in (value as Record<string, unknown>)

/**
 * 位置参数里直接放了一整份**动画**（`TransformAnimations(a, b)`）：按结构认，不另加标记——
 * 句柄标记有 `__handle`、组标记有 `__animations`、类名标记有 `__animClass`，都不占这三个键。
 */
const isNestedSpec = (value: unknown): value is AnimationSpec => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const bag = value as Record<string, unknown>
  return typeof bag.kind === 'string' && Array.isArray(bag.targets) && typeof bag.kwargs === 'object'
}

/** 单段动画时长封顶：默认时间够用，只挡 AI 写出 run_time=15 这种把卡片钉死的值。 */
const MAX_ANIMATION_SECONDS = 3

/**
 * 极速模式下动画一律压到 0 秒——manim-web 对 `duration <= 0` 的动画直接取 alpha=1
 * （`Animation.update` 里 `duration > 0 ? clamp(n / duration) : 1`），也就是**直接落终态**，
 * 于是 play 只花一帧就返回，不按 run_time 真等。
 */
const FAST_ANIMATION_SECONDS = 0

/** 极速模式推进 updater 的步长（模拟秒）与步数上限：不真等，但要保住轨迹形状。 */
const FAST_STEP_SECONDS = 1 / 60
const FAST_MAX_STEPS = 900

/** 极速模式下代替 scene.wait 用到的场景能力（manim-web 的公开成员）。 */
interface FastForwardScene {
  mobjects?: Iterable<{ hasUpdaters?: () => boolean; update?: (dt: number) => void }>
  render?: () => void
}

/**
 * 极速模式下的「等待」：不真等，把场景里的 updater 按固定步长推到 duration 之后，再渲染一帧。
 *
 * 为什么不干脆跳过：`TracedPath` 这类轨迹是**靠 updater 在 wait 里长出来的**。跳过的话画面
 * 停在上一帧、轨迹是空的，看着就像「没渲染成功」。按步长推能保住轨迹形状，只是不走真实时钟。
 * 没有 updater 的等待（绝大多数）本来就什么都不改变，那就直接省掉。
 */
function fastForward(scene: unknown, duration: number): void {
  const view = scene as FastForwardScene
  const all = view.mobjects === undefined ? [] : [...view.mobjects]
  const driven = all.filter((mobject) => mobject.hasUpdaters?.() === true)
  if (driven.length === 0) return
  const steps = Math.min(Math.ceil(duration / FAST_STEP_SECONDS), FAST_MAX_STEPS)
  const step = steps <= 0 ? 0 : duration / steps
  for (let index = 0; index < steps; index += 1) {
    for (const mobject of driven) mobject.update?.(step)
  }
  view.render?.()
}

/**
 * 极速模式下 play 结束后补跑一次 updater。真实 manim 的 play 每帧都先推动画、再跑 updater
 * （`Scene.update` 里 animations 先、mobjects 后），末帧落终态时 updater 也跑了最后一遍——
 * tracker 驱动的物体跟着走到新值。manim-web 的实时 play 循环确实每帧 `mobject.update(dt)`，
 * 但极速动画 duration=0 一帧不 tick，updater 就从未执行：`play(tracker.animate.set_value(2))`
 * 过后点还钉在起点，紧跟着的 `clear_updaters()` 就把「先到 2、再停住」变成了「从头到尾没动过」
 * （语料 updater-clear 的截图自查抓到的：终态红点停在 0，@expect 说应停在 2）。
 *
 * 补法：play 返回后按真实 run_time 补一次 `update(dt)`（对齐末帧语义；dt 用真实时长，
 * TracedPath 这类按 dt 记账的 updater 不会把整段轨迹缩成零时长）。只补极速路径——实时 play
 * 自带每帧 update，不用也不能重复补。
 */
function runUpdatersAfterFastPlay(scene: unknown, dt: number): void {
  const view = scene as FastForwardScene
  const all = view.mobjects === undefined ? [] : [...view.mobjects]
  for (const mobject of all) {
    if (mobject.hasUpdaters?.() === true) mobject.update?.(dt)
  }
}

/** 动画与动画代理共用的一点：都能设时长/速率（构造后改也生效，实测过）。 */
interface AnimationLike {
  duration?: number
  rateFunc?: (t: number) => number
}

/** 「终态补插值」要用到的一点：能按 alpha 把自己插到某个中间态（Transform / AnimateProxy 都有）。 */
interface Interpolatable {
  rateFunc?: unknown
  interpolate?: unknown
}

/** 上游 `_fadeInParts` 的条目形状（TransformMatchingTex / TransformMatchingShapes 共用）。 */
interface FadeInPart {
  mobject?: { parent?: unknown }
}

/** 收养孤儿要用到的一点：场景能 add、也能列出顶层物体（Set 或数组，两个构建不一样）。 */
interface AdoptingScene {
  add?: (...mobjects: unknown[]) => void
  mobjects?: unknown[] | ReadonlySet<unknown>
}

/**
 * 修上游 `TransformMatchingTex` / `TransformMatchingShapes` 的另一处坑：**淡入的那部分没进场景**。
 *
 * 上游把「没配上对的片段」做成目标的复制品、透明起步，然后挂到 `this.mobject.parent` 上
 * （`n && n.add(t)`）。而**顶层物体的 parent 是 null**（场景不是 Mobject），`n &&` 直接跳过——
 * 复制品造出来了、却没人把它加进场景。实测 `TransformMatchingTex(MathTex("a","=","b"), MathTex("x","=","y"))`
 * 跑完画面只剩配上对的「=」，"x" 和 "y" 凭空消失（截图自查抓到的：墨迹只剩 0.03%）。
 *
 * 补法：play 回来后把 `_fadeInParts` 里还没挂到场景的复制品**收养**进场景。字段是上游私有的，
 * 全程带形状守卫——上游哪天改名，这里静默退化成「不补」，不会炸。
 */
function adoptOrphanFadeIns(animation: unknown, scene: unknown): boolean {
  const parts = (animation as { _fadeInParts?: unknown })._fadeInParts
  if (!Array.isArray(parts) || parts.length === 0) return false
  const bag = scene as AdoptingScene
  if (typeof bag.add !== 'function') return false
  // manim-web 的 Scene.mobjects 是 **ReadonlySet**（headless 构建里是数组）——两种都得认。
  const present = bag.mobjects
  const inScene = (mobject: unknown): boolean =>
    Array.isArray(present) ? present.includes(mobject) : present instanceof Set ? present.has(mobject) : false
  let adopted = 0
  for (const part of parts as FadeInPart[]) {
    const mobject = part?.mobject
    if (mobject === null || typeof mobject !== 'object') continue
    if (mobject.parent !== null && mobject.parent !== undefined) continue
    if (inScene(mobject)) continue
    bag.add(mobject)
    adopted += 1
  }
  return adopted > 0
}

/** 弧线重造要用到的 Arc 侧能力（`TipableVMobject` 的两个加箭头方法）。 */
interface ArcLike {
  addTip?: (options?: Record<string, unknown>) => unknown
  addStartTip?: (options?: Record<string, unknown>) => unknown
}

/**
 * 上游「两点定弧」造歪了的形状，改用 `Arc` 重造（病根与修法见 surface.ts 的 `ARC_SHAPE_REPAIRS`）。
 *
 * 返回 `undefined` = 这个 kind 不用修（或选项里没有两端点，交给上游原样构造）。用真桥的
 * `manim.Arc` 造而不是改 `ArcBetweenPoints` 的 setter：`Arc.copy()` 会照传全部参数，所以修完
 * **可复制**；就地改 setter 的话 `copy()` 会把修过的负扫角再喂回坏公式、又翻回去。
 */
function buildArcShape(
  manim: ManimNamespace,
  kind: string,
  options: Record<string, unknown>,
): object | undefined {
  const repair = ARC_SHAPE_REPAIRS[kind]
  if (repair === undefined) return undefined
  const start = options[repair.startKey]
  const end = options[repair.endKey]
  if (!Array.isArray(start) || !Array.isArray(end)) return undefined
  // 默认张角照 manim-web 的选项定义：ArcBetweenPoints 是 π/2，CurvedArrow 家族是 π/4。
  const fallbackAngle = repair.tip === 'none' ? Math.PI / 2 : Math.PI / 4
  const angle = typeof options.angle === 'number' ? options.angle : fallbackAngle
  const geometry = arcBetweenPoints(start as number[], end as number[], angle)
  const color = typeof options.color === 'string' ? options.color : '#58C4DD'
  const strokeWidth = typeof options.strokeWidth === 'number' ? options.strokeWidth : 4
  const Ctor = manim.Arc as new (options: Record<string, unknown>) => ArcLike
  const arc = new Ctor({
    radius: geometry.radius,
    startAngle: geometry.startAngle,
    angle: geometry.sweep,
    center: geometry.center,
    color,
    strokeWidth,
  })
  if (repair.tip !== 'none') {
    const tipConfig = {
      tipLength: typeof options.tipLength === 'number' ? options.tipLength : 0.25,
      tipWidth: typeof options.tipWidth === 'number' ? options.tipWidth : 0.15,
      color,
    }
    arc.addTip?.(tipConfig)
    if (repair.tip === 'both') arc.addStartTip?.(tipConfig)
  }
  return arc as object
}

/**
 * 修上游 `Matrix` 的「条目被列抢走」bug：`_buildMatrix` 把同一个条目**先后 add 进行和列**
 * （`row.add(a)` 之后又 `columns[i].add(a)`），而 manim-web 的 `Mobject.add` 是**单亲**的——
 * 后一次 add 会把条目从行里偷走。列组从头到尾没挂上 Matrix，行组留在 `_content` 里却已空了，
 * 于是矩阵只剩一对括号、**内容全空**（截图自查抓到的：`Matrix([[1,2],[3,4]])` 画面只有括号）。
 *
 * 补法：把每个条目还回它所在的行（`add` 自己会从列里摘走），`_content` 与行组的挂接没断过、
 * 不用动。返回条目清单（调用方要顺手登记它们的异步渲染等待——条目是 MathTexImage，光栅化
 * 是异步的，见 `trackRender`）。字段是上游私有的，全程带形状守卫：上游哪天改结构，这里
 * 静默退化成「不修」。
 */
function repairMatrixEntries(instance: unknown): unknown[] {
  const view = instance as { _entries?: unknown; _rows?: unknown }
  const entries = view._entries
  const rows = view._rows
  if (!Array.isArray(entries) || !Array.isArray(rows)) return []
  const collected: unknown[] = []
  for (let r = 0; r < rows.length && r < entries.length; r += 1) {
    const row = rows[r] as { add?: (...mobjects: unknown[]) => unknown }
    if (row === null || typeof row !== 'object' || typeof row.add !== 'function') continue
    for (const entry of entries[r] as unknown[]) {
      if (entry === null || typeof entry !== 'object') continue
      // 已经在行里的（上游哪天修好了）不要动——add 会摘下来再塞回去，白改一遍层级
      if ((entry as { parent?: unknown }).parent === row) {
        collected.push(entry)
        continue
      }
      row.add(entry)
      collected.push(entry)
    }
  }
  return collected
}

/** 条目的异步渲染等待（MathTexImage 家族）：create 时登记，play/wait 开头 flush。 */
interface RenderAwaitable {
  waitForRender?: () => Promise<void>
}

/**
 * 上游 `Tex` 的坑：它继承 MathTex，但构造时把每段 latex 包进 `\text{...}`（模仿 CE 的
 * Tex 走文本模式）。副作用是 LaTeX 语法全被当字面文本——`Tex("E = mc^2")` 的 `^` 排成
 * 一个字面 `^`、没有上标（截图自查 text-tex-plain 抓到的）。
 *
 * 修法：构造时把 Tex 改道 MathTex——manim-web 的 KaTeX 管线只有数学模式一种，「Tex 也是
 * LaTeX 全文」就该照排（与 MathTex 同管线，参数形状两者本来就一致：pack 到 `latex` 键）。
 */
const KIND_ALIAS: Record<string, string> = { Tex: 'MathTex' }

/**
 * 上游 `Angle` 三点输入把顺时针角画成优弧（病根与算法见 surface.ts 的 `angleFromPoints`），
 * 同弧线修法：用 `Arc` 按「顶点为圆心、第一射线为起始角、带符号扫角」重造。
 *
 * 返回 `undefined` = 不归这管（不是三点输入 / 3D 的角 / 用了 `quadrant` `showValue` 这类
 * 重造后接不住的选项——那就交回上游原样构造）。`radius` 是两边共用的选项名，直接照传。
 */
function buildAngleShape(
  manim: ManimNamespace,
  input: Record<string, unknown>,
  options: Record<string, unknown>,
): object | undefined {
  const points = input.points
  if (!Array.isArray(points) || points.length !== 3) return undefined
  const [start, vertex, end] = points as unknown[]
  if (!Array.isArray(start) || !Array.isArray(vertex) || !Array.isArray(end)) return undefined
  // 3D 的角另有一套平面取向，不在这里重造
  const flat = (p: number[]): boolean => Math.abs(p[2] ?? 0) < 1e-9
  if (!flat(start) || !flat(vertex) || !flat(end)) return undefined
  if (options.quadrant !== undefined || options.showValue !== undefined) return undefined
  const geometry = angleFromPoints(start as number[], vertex as number[], end as number[], options.otherAngle === true)
  const Ctor = manim.Arc as new (options: Record<string, unknown>) => object
  return new Ctor({
    radius: typeof options.radius === 'number' ? options.radius : 0.5,
    startAngle: geometry.startAngle,
    angle: geometry.sweep,
    center: geometry.center,
    color: typeof options.color === 'string' ? options.color : '#FFFFFF',
    strokeWidth: typeof options.strokeWidth === 'number' ? options.strokeWidth : 4,
  })
}

/**
 * 修上游 manim-web 的一处「收尾不看 rateFunc」的 bug。
 *
 * CE 的语义是 `Animation.finish()` 调 `interpolate(rate_func(1))`，所以**回程型**速率
 * （`there_and_back` / `there_and_back_with_pause`，`rateFunc(1)=0`）跑完要**回到起点**。
 * manim-web 里分两步：基类 `Animation.update()` 收尾前确实按 `interpolate(rateFunc(1))` 摆好了，
 * 紧接着调 `finish()`——而 `AnimateProxy.finish()`（`.animate` 链）与 `Transform.finish()`
 * （经 `strategy.finish`）**直接重建目标态 / 钉到 target**，把刚摆好的中间态覆盖掉。
 * 实测（manim-web 0.3.24，Node 真场景）：`play(dot.animate.shift(RIGHT*3), rate_func=there_and_back)`
 * 终态停在 x=3 而不是回到 0——真机就表现为「点一路移过去不回原点」，极速模式更看不出动画。
 *
 * 补法**只碰终值不等于 1 的速率函数**：把物体重新插值到 `rateFunc(1)`。默认速率（smooth / linear /
 * ease_* …）终值就是 1，目标态即正确终态，一律不动——因此不会误伤 `Indicate` / `Flash` / `Wiggle`
 * 这类「收尾另有安排、但终值恰为 1」的瞬态动画。`interpolate` 会标脏，桥随后补一帧渲染。
 *
 * 返回是否真的改过（决定要不要补渲染）。
 */
function settleRateTerminal(animation: unknown): boolean {
  const view = animation as Interpolatable
  if (typeof view.rateFunc !== 'function' || typeof view.interpolate !== 'function') return false
  let alpha: number
  try {
    alpha = (view.rateFunc as (t: number) => number)(1)
  } catch {
    return false
  }
  if (!Number.isFinite(alpha) || Math.abs(alpha - 1) < 1e-9) return false
  try {
    ;(view.interpolate as (alpha: number) => void)(alpha)
    return true
  } catch {
    // 极少数动画收尾后不再可插值——保持 finish() 的终态，别把一次 play 弄挂
    return false
  }
}

/**
 * manim-web 的 moveTo 内部要量包围盒；包围盒由 Three.js 从**渲染树**算，在**无 WebGL 的干跑 /
 * 回归环境**里，物体带「永远渲染不出来的孩子」（BarChart / UnitInterval 里的数字、公式纹理）
 * 时会抛 `Mobject.getBounds(): … produced empty Three.js bounds`。真浏览器量得出来，不进这条路
 * ——所以这是「门禁比现实严格」的同判性缺口（同一份代码浏览器能跑、Node 门禁拒绝）。
 *
 * 修法不是让语料绕开，而是桥上兜底：中心按**全部点的均值**手算（真 Manim 的 get_center 就是这个
 * 定义），点的读取与递归子物体都不经过渲染器；算出中心后 shift（纯点运算，同样不碰包围盒）。
 * 一个点都读不出来时兜底失败、原样抛错——那说明物体真空几何，浏览器里同样画不出。
 * 只兜 move_to：to_edge / next_to 的语义要读「别的物体」、scale 在 manim-web 里无条件量包围盒
 * （显式 about_point 也拦不住），这两个兜不了——坐标系这类要用构造参数（x_length / radius_max）定尺寸。
 */
const BOUNDS_ERROR = /empty Three\.js bounds/
const CENTER_FALLBACK_METHODS = new Set(['move_to'])

/** 递归收集一个 manim-web 物体（含全部子物体）的点的均值；一个点都没有返回 null。 */
function centerFromPoints(target: Record<string, unknown>, depth = 0): number[] | null {
  const acc = { x: 0, y: 0, z: 0, n: 0 }
  const visit = (node: Record<string, unknown>, level: number): void => {
    const getPoints = node.getPoints
    if (typeof getPoints === 'function') {
      try {
        const raw = (getPoints as () => unknown).call(node)
        const flat: number[] = []
        if (Array.isArray(raw)) {
          for (const item of raw as unknown[]) {
            if (typeof item === 'number') flat.push(item)
            else if (Array.isArray(item)) for (const value of item as number[]) flat.push(Number(value))
          }
        } else if (ArrayBuffer.isView(raw)) {
          for (const value of raw as ArrayLike<number>) flat.push(Number(value))
        }
        for (let index = 0; index + 2 < flat.length; index += 3) {
          const [x, y, z] = [flat[index], flat[index + 1], flat[index + 2]]
          if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
            acc.x += x
            acc.y += y
            acc.z += z
            acc.n += 1
          }
        }
      } catch {
        // 这个孩子读不出点就跳过——要的不是精确包围盒，是一个能用的中心
      }
    }
    const kids = node.children
    if (level < 6 && Array.isArray(kids)) {
      for (const kid of kids as Record<string, unknown>[]) {
        if (kid !== null && typeof kid === 'object') visit(kid, level + 1)
      }
    }
  }
  visit(target, depth)
  return acc.n === 0 ? null : [acc.x / acc.n, acc.y / acc.n, acc.z / acc.n]
}

function recoverBoundsFailure(
  target: Record<string, unknown>,
  name: string,
  args: unknown[],
  error: unknown,
): 'recovered' | null {
  if (!CENTER_FALLBACK_METHODS.has(name)) return null
  if (!BOUNDS_ERROR.test(error instanceof Error ? error.message : String(error))) return null
  const point = Array.from((args[0] as ArrayLike<unknown> | undefined) ?? [], Number)
  if (point.length < 2 || point.some((value) => !Number.isFinite(value))) return null
  const center = centerFromPoints(target)
  if (center === null) return null
  const shift = target.shift
  if (typeof shift !== 'function') return null
  ;(shift as (...a: unknown[]) => unknown).call(target, [
    point[0] - center[0],
    point[1] - center[1],
    (point[2] ?? 0) - (center[2] ?? 0),
  ])
  return 'recovered'
}

export function createManimWebBridge(options: ManimWebBridgeOptions): ManimBridge {
  const { manim, scene } = options
  const fast = options.fast === true
  const objects = new Map<number, unknown>()
  const SCENE_HANDLE = 0
  objects.set(SCENE_HANDLE, scene)
  let nextHandle = 1

  const ref = (value: unknown): number => {
    const handle = nextHandle++
    objects.set(handle, value)
    return handle
  }

  const deref = (handle: number): unknown => {
    if (!objects.has(handle)) throw new Error(`未知的对象句柄 ${handle}`)
    return objects.get(handle)
  }

  const resolve = (value: unknown): unknown => (isHandleTag(value) ? deref(value[HANDLE_KEY]) : value)

  /**
   * 深解析：句柄标记嵌在**数组与关键字**里也要还原成真对象——RightAngle(line1=Line(...))
   * 的 line1、Table([[a, b]]) 的内层元素，原样过桥就是 `{ __handle }` 空壳，manim-web
   * 拿它当真对象用就炸（「e.line1.getStart is not a function」「e.children is not iterable」）。
   */
  const deepResolve = (value: unknown): unknown => {
    const resolved = resolve(value)
    if (Array.isArray(resolved)) return resolved.map(deepResolve)
    if (resolved !== null && typeof resolved === 'object' && !isMobject(resolved)) {
      const out: Record<string, unknown> = {}
      for (const [key, item] of Object.entries(resolved as Record<string, unknown>)) {
        out[key] = deepResolve(item)
      }
      return out
    }
    return resolved
  }

  const isMobject = (value: unknown): boolean =>
    typeof value === 'object' && value !== null && value instanceof manim.Mobject

  /** manim 对象进句柄表，其余原样返回——Python 侧据 __handle 决定是否包成 Mobject。 */
  const tag = (value: unknown): unknown => (isMobject(value) ? { [HANDLE_KEY]: ref(value) } : value)

  /**
   * MathTex/Tex 渲染等待：排版是异步的，渲染完之前宽度是 0，`to_edge` / `next_to` 这类
   * 定位会按 0 宽算错（角落标签两位数被顶出画面就是这个）。create 时登记渲染 promise，
   * Python 侧在 MathTex 构造之后插入的 `_flush_after` 与 play/wait 的开头都 flush。
   * 兜底超时：渲染失败（KaTeX 异常等）也要能继续跑，不能把整个程序吊死。
   */
  const RENDER_FLUSH_TIMEOUT_MS = 5000
  const renders: Promise<void>[] = []
  const trackRender = (promise: Promise<void>): void => {
    renders.push(
      Promise.race([
        // 渲染失败（如 KaTeX 异常）manim-web 自己会打日志，flush 不因此中断程序
        promise.catch(() => {}),
        new Promise<void>((resolve) => setTimeout(resolve, RENDER_FLUSH_TIMEOUT_MS)),
      ]),
    )
  }
  const flushRenders = async (): Promise<void> => {
    const pending = [...renders]
    renders.length = 0
    await Promise.all(pending)
  }

  return {
    create(kind, args, kwargs) {
      if (kind === 'Scene') return SCENE_HANDLE
      // 位置参数与关键字都先深解析（句柄标记换真对象），再交给支持面定形状（规则在 surface.ts）
      const ctorArgs = planCreate(kind, args.map(deepResolve), deepResolve(kwargs) as Record<string, unknown>)
      // 上游造歪的弧线形状先用 Arc 重造（surface 的 ARC_SHAPE_REPAIRS 点名了是哪几个）。
      const repaired =
        ARC_SHAPE_REPAIRS[kind] === undefined
          ? undefined
          : buildArcShape(manim, kind, (ctorArgs[0] ?? {}) as Record<string, unknown>)
      // Angle 的三点输入同病（顺时针角画成优弧）：也用 Arc 重造（input 与 options 是两个参数）。
      const angleRepaired =
        ANGLE_POINTS_REBUILT.has(kind)
          ? buildAngleShape(
              manim,
              (ctorArgs[0] ?? {}) as Record<string, unknown>,
              (ctorArgs[1] ?? {}) as Record<string, unknown>,
            )
          : undefined
      const Ctor = manim[KIND_ALIAS[kind] ?? kind]
      if (repaired === undefined && angleRepaired === undefined && typeof Ctor !== 'function') {
        throw new Error(`${kind} 在 manim-web 里没有对应类——检查拼写，或改用已支持的形状`)
      }
      const instance = repaired ?? angleRepaired ?? new (Ctor as new (...a: unknown[]) => object)(...ctorArgs)
      // MathTex/Tex 的排版是异步的：登记渲染等待，Python 侧在构造后 flush（见 flush）。
      const renderable = instance as { waitForRender?: () => Promise<void> }
      if (typeof renderable.waitForRender === 'function') trackRender(renderable.waitForRender())
      // Matrix 的条目被列组偷走（上游单亲 add 的坑，见 repairMatrixEntries）：还回行里，
      // 并把每个条目（MathTexImage，光栅化异步）的渲染等待也登记上——不登记的话 play 在
      // 纹理落地前就开始 Write，极速模式下更是直接量到一张空画面。
      for (const entry of repairMatrixEntries(instance)) {
        const awaitable = entry as RenderAwaitable
        if (typeof awaitable.waitForRender === 'function') trackRender(awaitable.waitForRender())
      }
      return ref(instance)
    },

    method(handle, name, args, kwargs) {
      const target = deref(handle) as Record<string, unknown>
      // 名字映射、改写、放行口径都来自支持面；执行期只剩「对象上有没有这组方法」
      const plan = planMethod(name, args.map(deepResolve), deepResolve(kwargs) as Record<string, unknown>)
      for (const calls of plan.variants) {
        // prop 调用是属性写（存取器），不看是不是函数、只要槽位在（见 MethodCall 注）。
        if (!calls.every((call) => (call.prop === true ? call.js in target : typeof target[call.js] === 'function'))) continue
        try {
          let result: unknown = target
          for (const call of calls) {
            if (call.prop === true) {
              ;(target as Record<string, unknown>)[call.js] = call.args[0]
              result = target
            } else {
              result = (target[call.js] as (...a: unknown[]) => unknown).apply(target, call.args)
            }
          }
          // CE 这些方法是原地改、返回自身（manim-web 的 setter 也返回 this）——依旧句柄最省事；
          // 返回了新对象的方法（copy 这类）走 tag，让 Python 侧包成新 Mobject。
          return result === target ? { [HANDLE_KEY]: handle } : tag(result)
        } catch (error) {
          const recovered = recoverBoundsFailure(target, name, args.map(deepResolve), error)
          if (recovered === null) throw error
          return { [HANDLE_KEY]: handle }
        }
      }
      throw new Error(`${name}() 在 manim-web 无对应方法——检查拼写，或查支持速查表`)
    },

    getAttr(handle, name) {
      // 属性读取也走支持面：名字放行与否、是方法还是存取器，都由 PROP_READS 定（见 planAttrRead）。
      const plan = planAttrRead(name)
      const target = deref(handle) as Record<string, unknown>
      const value = target[plan.jsName]
      if (plan.via === 'method') {
        if (typeof value !== 'function') throw new Error(`读属性 ${name} 失败——manim-web 没有 ${plan.jsName}()`)
        return tag((value as () => unknown).call(target))
      }
      return tag(value)
    },

    add(handle, mobjects) {
      const target = deref(handle) as { add?: (...m: unknown[]) => void }
      if (typeof target.add !== 'function') throw new Error('add 只能用于场景')
      target.add(...mobjects.map(deref))
    },

    async play(handle, animations, kwargs) {
      const target = deref(handle) as { play: (...a: unknown[]) => Promise<void> }
      if (typeof target.play !== 'function') throw new Error('play 只能用于场景')
      await flushRenders()

      // 选项的判定全在支持面（planPlayOptions / planAnimation）——预检取同一份，两端才同判。
      const playPlan = planPlayOptions(kwargs)
      const playRate = playPlan.rate === undefined ? undefined : rateFunction(playPlan.rate)

      /**
       * 位置参数逐个还原：句柄标记换真对象、组动画标记展开成动画对象、**动画类名标记**换真类、
       * 嵌套的**单份动画**（TransformAnimations / ChangeSpeed）构造出来、数组逐项还原
       * （CyclicReplace 那类把一串物体打包成一个数组参数的）、其余（角度/向量/颜色）原样。
       */
      const buildArg = (arg: AnimationTarget): unknown => {
        if (isHandleTag(arg)) return deref(arg[HANDLE_KEY])
        if (isGroupTag(arg)) return arg[GROUP_KEY].map(build)
        if (isAnimClassTag(arg)) {
          const exported = manim[arg[ANIM_CLASS_KEY]]
          if (typeof exported !== 'function') {
            throw new Error(`动画类 ${arg[ANIM_CLASS_KEY]} 在 manim-web 里没有对应实现`)
          }
          return exported
        }
        // 「恒定速度函数」标记（ChangeSpeed 的 speed_factor）：函数在这一侧现造。
        if (isSpeedTag(arg)) {
          const factor = arg[SPEED_KEY]
          return typeof factor === 'number' ? (): number => factor : factor
        }
        // 单份嵌套动画（TransformAnimations(a, b) 的两个动画）：按结构认，句柄/组标记都不占
        // kind/targets/kwargs 这三键，不会认错。
        if (isNestedSpec(arg)) return build(arg)
        return Array.isArray(arg) ? (arg as AnimationTarget[]).map(buildArg) : arg
      }

      /** rate_func 标记 → manim-web 的真函数；柯里化的（runningStart 那类）要先无参调一次。 */
      function rateFunction(plan: RatePlan): (t: number) => number {
        const exported = manim[plan.js]
        if (typeof exported !== 'function') throw new Error(`速率函数 ${plan.js} 在 manim-web 里没有`)
        const fn = plan.curried ? (exported as () => unknown)() : exported
        if (typeof fn !== 'function') throw new Error(`速率函数 ${plan.js} 不能无条件调用——查支持速查表`)
        return fn as (t: number) => number
      }

      /** 选项里的 rateFunc 是 RatePlan（判定给的），到这里才换成真函数。 */
      const buildOptions = (options: Record<string, unknown>): Record<string, unknown> => {
        const out: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(options)) {
          out[key] = key === 'rateFunc' ? rateFunction(value as RatePlan) : value
        }
        return out
      }

      /** 时长与速率的最终归属：play 级覆盖每段（CE 的 play(..., run_time=) 就是这个语义），并封顶。 */
      const applyOptions = <T extends AnimationLike>(animation: T): T => {
        // 极速：不按 run_time 走，一律压 0（Math.min(0, 3) 仍是 0）
        const wanted = fast ? FAST_ANIMATION_SECONDS : playPlan.duration ?? animation.duration
        if (typeof wanted === 'number') animation.duration = Math.min(wanted, MAX_ANIMATION_SECONDS)
        if (playRate !== undefined) animation.rateFunc = playRate
        return animation
      }

      /**
       * `.animate` 链：拿目标的 animate 代理，按 calls 依次 builder 式调用，得到动画对象。
       *
       * 代理的方法面是**写死的一组 builder**（不转发），所以支持面改写过、而代理上没有的名字
       * 要退到**物体本身**上试一次——`ValueTracker` 的值动画就是这样：`animateTo(v)` 直接返回
       * 一个动画（不是链）。两种都接不住才报错。
       */
      const buildAnimate = (spec: AnimationSpec): AnimationLike => {
        const mobject = buildArg(spec.targets[0] as AnimationTarget) as Record<string, unknown>
        if (mobject === null || typeof mobject !== 'object' || mobject.animate === undefined || mobject.animate === null) {
          throw new Error('该对象没有 .animate——manim-web 不支持 animate 链')
        }
        let proxy: unknown = mobject.animate
        for (const call of planAnimate(spec.calls ?? [])) {
          // kwargs 要按代理的**位置参数签名**摊开（见 animateCallArgs）：直接当尾参对象塞进去
          // 会让 `set_fill(BLUE, opacity=0.6)` 的填充不透明度变成 NaN（动画跑通、画面没填充）。
          const kw = camelKeys(deepResolve(call.kwargs) as Record<string, unknown>)
          const args = call.args.map(resolve)
          const invoke = (receiver: unknown): unknown => {
            const fn = (receiver as Record<string, unknown>)[call.name]
            if (typeof fn !== 'function') return undefined
            return (fn as (...a: unknown[]) => unknown).apply(receiver, animateCallArgs(call.name, args, kw))
          }
          const viaProxy = invoke(proxy)
          if (viaProxy !== undefined) {
            proxy = viaProxy
            continue
          }
          const direct = invoke(mobject)
          if (direct === undefined) throw new Error(`animate 链不支持 ${call.name}()`)
          proxy = direct
        }
        return applyOptions(proxy as AnimationLike)
      }

      /** 按表把 CE 动画名取成 manim-web 的工厂（兜底用的 FadeOut / FadeIn / AnimationGroup 走这里，名字只在表里写一次）。 */
      const factoryOf = (name: string): ((...a: unknown[]) => AnimationLike) => {
        const js = PY_API_MAP[name]?.js
        const fn = typeof js === 'string' ? manim[js] : undefined
        if (typeof fn !== 'function') {
          throw new Error(`${name} 在 manim-web 里没有对应实现——检查拼写或查支持速查表`)
        }
        return fn as (...a: unknown[]) => AnimationLike
      }

      /** 交叉淡入淡出：源淡出、目标淡入——「点数对不齐、morph 不了」时的兜底，全程不碰点数。 */
      const crossFade = (source: unknown, target: unknown, options: Record<string, unknown>): AnimationLike =>
        factoryOf('AnimationGroup')([factoryOf('FadeOut')(source), factoryOf('FadeIn')(target)], options)

      /** 这一趟真跑过 morph 的配对：跑完要顺手治一遍记账（见 healSubpathBookkeeping）。 */
      const morphPairs: [unknown, unknown][] = []

      /**
       * 「点数对齐」型动画能不能在**这一对**上跑：拿复制品试跑一次 `begin()`。
       *
       * 为什么不用启发式（比点数、比子物数）：对不齐的判据在 manim-web 内部的 `alignVmobjectPair` 里
       * （先试子路径对齐、再退回 `alignPoints`，两者都不成才抛），照抄一份必然漂移；直接跑它自己的
       * `begin()` 是**同一份逻辑**（`begin()` 不吃场景、只改自己那份 mobject，传复制品不污染真对象）。
       *
       * ⚠️ 只对**不需要异步排版**的物体这么做：MathTex/Tex/Text 这类「构造即发起排版」，复制品会各自
       * 再排一次版，Node（无 DOM）里必然失败成**未处理拒绝**（污染测试、CI 退出码非零）。这类物体
       * 复制不安全——返回 undefined 让调用方按保守侧走兜底。
       */
      const copyForProbe = (mobject: unknown): unknown => {
        const original = mobject as { copy?: () => unknown; waitForRender?: unknown }
        if (typeof original?.copy !== 'function' || typeof original.waitForRender === 'function') return undefined
        return original.copy()
      }
      const canMorph = (make: (args: unknown[]) => AnimationLike, source: unknown, target: unknown): boolean => {
        const sourceCopy = copyForProbe(source)
        const targetCopy = copyForProbe(target)
        if (sourceCopy === undefined || targetCopy === undefined) return false
        try {
          const probe = make([sourceCopy, targetCopy])
          ;(probe as { begin?: () => void }).begin?.()
          return true
        } catch {
          return false
        }
      }

      const build = (spec: AnimationSpec): AnimationLike => {        if (spec.kind === ANIMATE_KIND) return buildAnimate(spec)
        // 调谁、怎么调、传什么选项：判定给（表实测 manim-web 的工厂/类形状，见支持面 SSOT）
        const plan = planAnimation(spec.kind, spec.targets, spec.kwargs)
        // 位置参数用判定改写过的（顺序/打包与 CE 不同的那几个），没改写就是原样。
        const args = (plan.targets ?? spec.targets).map(buildArg)
        const options = buildOptions(plan.options)
        const callable = manim[plan.js]
        if (typeof callable !== 'function') {
          throw new Error(`${spec.kind} 在 manim-web 里没有对应实现——检查拼写或查支持速查表`)
        }
        // 选项作为**最后一个位置参数**传：manim-web 的工厂与类构造器都把它放在末尾。
        const tail = Object.keys(options).length > 0 ? [options] : []
        const make = (call: unknown[]): AnimationLike =>
          plan.call === 'factory'
            ? (callable as (...a: unknown[]) => AnimationLike)(...call, ...tail)
            : new (callable as new (...a: unknown[]) => AnimationLike)(...call, ...tail)
        // 「点数对齐」型动画（Transform 家族）对不齐那一对时会抛在渲染循环里——先判这一对，判不过才兜底。
        const morph = plan.pointMorph
        if (morph !== undefined && args.length >= 2 && isMobject(args[0]) && isMobject(args[1])) {
          const [source, target] = args
          // 记账已经对不上的（含子物，见 healSubpathBookkeeping）必然抛在第一道对账上——这一关先拦掉。
          const sound = subpathTreeConsistent(source) && subpathTreeConsistent(target)
          // 两端都是 VGroup 且这支「按子物配对」⇒ 与点数无关，直接走真动画（也就免了复制 VGroup 里的文字）。
          const groupPair = source instanceof manim.VGroup && target instanceof manim.VGroup
          if (!sound || (!(morph.vgroupSafe && groupPair) && !canMorph(make, source, target))) {
            return applyOptions(crossFade(source, target, options))
          }
          morphPairs.push([source, target])
        }
        return applyOptions(make(args))
      }

      const built = animations.map(build)
      await target.play(...built)
      // 极速模式补末帧 updater（见 runUpdatersAfterFastPlay 的注释）；实时 play 自带每帧 update
      if (fast) runUpdatersAfterFastPlay(target, playPlan.duration ?? 0)
      // 三处上游补丁（settleRateTerminal / adoptOrphanFadeIns / healSubpathBookkeeping）——
      // 改过就补一帧渲染，否则最后一帧还停在 play 结束时渲染循环留下的样子。
      let healed = false
      for (const [source, target_] of morphPairs) {
        healed = healSubpathBookkeeping(source) || healed
        healed = healSubpathBookkeeping(target_) || healed
      }
      const patched =
        healed ||
        built.some(settleRateTerminal) ||
        built.some((animation) => adoptOrphanFadeIns(animation, target))
      if (patched) {
        ;(target as { render?: () => void }).render?.()
      }
    },

    async wait(handle, duration) {
      const target = deref(handle) as FastForwardScene & { wait?: (d?: number) => Promise<void> }
      if (typeof target.wait !== 'function') throw new Error('wait 只能用于场景')
      await flushRenders()
      if (fast) {
        fastForward(target, duration)
        return
      }
      await target.wait(duration)
    },

    async flush() {
      await flushRenders()
    },
  }
}
