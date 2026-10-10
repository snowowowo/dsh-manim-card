/**
 * Manim ↔ JS 桥：Python 侧的 manim 适配层只能通过下面这组基元去驱动真正的 manim-web 对象。
 * runtime.ts 把它们注册成 Python 里可直呼的内置函数（_mb_*），适配层（manim-shim.ts）再用它写出
 * 「标准的 Manim 写法」。真渲染引擎把一块已建好的 manim-web Scene 交给 manim-bridge.ts 即可。
 */

/** 对象结果的标记键：JS 侧把 manim 对象折成 `{ __handle: n }`，Python 侧据此包成 Mobject。 */
export const HANDLE_KEY = '__handle'

/** `m.animate.<方法>(...)` 链的哨兵 kind——它不是 manim-web 的类，由桥单独展开。 */
export const ANIMATE_KIND = 'animate'

/** 组动画的标记键：`AnimationGroup([Create(a), FadeIn(b)])` 那种「一个参数是一串动画」。 */
export const GROUP_KEY = '__animations'

/**
 * 「这个位置参数是一个**动画类**」的标记键：`LaggedStartMap(FadeIn, group)`。
 *
 * 动画类只能按**名字**过桥（Python 里 FadeIn 是我们造的工厂函数，过不去也认不出）——
 * 适配层把它折成 `{ __animClass: "FadeIn" }`，判定层换成 manim-web 的导出名，桥再取回真类。
 */
export const ANIM_CLASS_KEY = '__animClass'

/**
 * 「一个恒定的速度函数」的标记键：CE 的 `ChangeSpeed(anim, speed_factor=2)` 给的是**数字**，
 * 而 manim-web 的 `changeSpeed(animation, speedFunc)` 要一个 `(t) => number` 的**函数**——
 * 函数只能在桥那一侧现造（Python 侧造出来的过不桥），所以先把数字标记好带过去。
 * 与 `rate_func` 的 RatePlan 同一套路：判定给标记，桥侧解析成真函数。
 */
export const SPEED_KEY = '__speedFactor'

/**
 * 动画位置参数的线格式。
 *
 * 位置参数里对象与原始值混在一起（`Transform(a, b)` 两个对象、`Rotate(c, PI)` 对象+角度、
 * `GrowFromEdge(c, LEFT)` 对象+向量），而**原始值里也有数字和数组**——曾经用「数字=句柄、
 * 数组=组动画」区分，于是 `Rotate(c, PI)` 把 PI 当句柄去查表，报「未知的对象句柄 3.14」。
 * 所以现在：对象一律带 `__handle` 标记、组动画带 `__animations` 标记，其余原样。
 */
export type AnimationTarget =
  | { [HANDLE_KEY]: number }
  | { [GROUP_KEY]: AnimationSpec[] }
  | number
  | string
  | boolean
  | null
  | unknown[]
  | Record<string, unknown>

/**
 * 一次动画：`Create(circle)` 这种，交给 scene.play 播放。
 * 位置参数用数组——多数动画只收一个目标（`Create(circle)`），
 * 但 `Transform(a, b)` 收两个、`Rotate(m, angle)` 收两个；组动画
 * （AnimationGroup / LaggedStart / Succession）的单个参数是**一串动画**（见 GROUP_KEY）。
 */
export interface AnimationSpec {
  /** CE 的动画名（Rotate / Create / Write…）；animate 链是 ANIMATE_KIND。 */
  kind: string
  /** 位置参数，线格式见 AnimationTarget。 */
  targets: AnimationTarget[]
  kwargs: Record<string, unknown>
  /**
   * `.animate` 链（kind === ANIMATE_KIND 时）：依次在目标上调用的方法。
   * name 已是 manim-web 的 camelCase 方法名——适配层按 _ANIMATE_METHODS 映射好再发过来。
   */
  calls?: Array<{ name: string; args: unknown[]; kwargs: Record<string, unknown> }>
}

export interface ManimBridge {
  /** 构造一个 manim-web 对象（Circle / Text / Scene …），返回对象句柄。args 是位置参数原文。 */
  create(kind: string, args: unknown[], kwargs: Record<string, unknown>): number
  /** 对句柄调方法；结果是 manim 对象则返回 `{ __handle }`，否则原样返回。 */
  method(handle: number, name: string, args: unknown[], kwargs: Record<string, unknown>): unknown
  /** 读属性；同上。 */
  getAttr(handle: number, name: string): unknown
  /** scene.add(...mobjects) */
  add(handle: number, mobjects: number[]): void
  /** scene.play(...animations)——播完才 resolve；Python 侧靠 suspension 等它。 */
  play(handle: number, animations: AnimationSpec[], kwargs: Record<string, unknown>): Promise<void>
  /** scene.wait(duration) */
  wait(handle: number, duration: number): Promise<void>
  /**
   * 等待所有已发起的 MathTex/Tex 渲染完成（真桥实现；空桥/预检即时返回）。
   * MathTex 的排版是异步的——渲染完之前宽度是 0，`to_edge` / `next_to` 这类定位
   * 会按 0 宽算错（两位数的角落标签就是被顶出画面的）。Python 侧在 MathTex 构造
   * 之后插入 `await`，落到这里。
   */
  flush(): Promise<void>
}

/** 一次桥调用的记录，供空桥与测试断言用。 */
export type BridgeOp =
  | { op: 'create'; kind: string; args: unknown[]; kwargs: Record<string, unknown>; handle: number }
  | { op: 'method'; handle: number; name: string; args: unknown[]; kwargs: Record<string, unknown> }
  | { op: 'getAttr'; handle: number; name: string }
  | { op: 'add'; handle: number; mobjects: number[] }
  | { op: 'play'; handle: number; animations: AnimationSpec[]; kwargs: Record<string, unknown> }
  | { op: 'wait'; handle: number; duration: number }

export interface RecordingBridge extends ManimBridge {
  readonly ops: BridgeOp[]
}

/** 空桥：只记录调用、不碰真对象——验证运行时与适配层的接线，不依赖 manim-web。 */
export function createRecordingBridge(): RecordingBridge {
  const ops: BridgeOp[] = []
  let nextHandle = 1
  // VGroup 的子物体数：`m[i]` 越界要返 undefined，`for m in group` 才收得了尾（与真桥/预检桥同判）。
  const sizes = new Map<number, number>()
  return {
    ops,
    create(kind, args, kwargs) {
      const handle = nextHandle++
      if (kind === 'VGroup') sizes.set(handle, args.length)
      ops.push({ op: 'create', kind, args, kwargs, handle })
      return handle
    },
    method(handle, name, args, kwargs) {
      ops.push({ op: 'method', handle, name, args, kwargs })
      if ((name === 'get' || name === 'getPart') && sizes.has(handle)) {
        const index = args[0]
        if (typeof index === 'number' && Number.isInteger(index) && index >= sizes.get(handle)!) {
          return undefined
        }
      }
      return { [HANDLE_KEY]: nextHandle++ }
    },
    getAttr(handle, name) {
      ops.push({ op: 'getAttr', handle, name })
      // 与真桥/预检桥同判：组（VGroup）的 length 是子物体数，其余返回占位句柄（len 会 TypeError）。
      if (name === 'length' && sizes.has(handle)) return sizes.get(handle)
      return { [HANDLE_KEY]: nextHandle++ }
    },
    add(handle, mobjects) {
      ops.push({ op: 'add', handle, mobjects })
    },
    async play(handle, animations, kwargs) {
      ops.push({ op: 'play', handle, animations, kwargs })
    },
    async wait(handle, duration) {
      ops.push({ op: 'wait', handle, duration })
    },
    async flush() {},
  }
}
