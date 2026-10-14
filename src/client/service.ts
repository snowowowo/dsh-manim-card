// 对外服务 `manim-card`：别的插件经 `ctx.get('manim-card')` 拿到的四件事——**预检、
// 画布、环境状态快照、环境状态订阅**。卡片 UI、Host 工具、分步播放/播放头/旁白都不在这里——
// 前者是本插件自己的入口，后者是调用方自己的事（见顶层设计 §5、§6）。
// 插件之间禁止 import，所以这是唯一的协作面：服务缺席时调用方退化成「没有画布」，不报错、不阻塞。
//
// 抽包（Phase 1）之后这一层只剩「接线」：真本事（Pyodide 运行时、manim 适配层、支持面、画布、
// 环境状态）全在核心包 `manim-live`。本插件要做的只有一件核心包做不到的事——**告诉它资源挂在哪**：
// Pyodide 与 KaTeX 都由本插件的 Host 路由分发，核心包不知道（也不该知道）这个前缀。
//
// 状态这两个成员**必须**走服务面，不能由调用方自己 import 核心包读：插件各自打包，调用方
// 直接 import 会打进**第二份**核心包，那份里的运行时阶段、订阅表、Pyodide 单例都是另一个实例，
// 读数永远停在 idle——真正在跑的那一份在本插件的 bundle 里（详见 docs/api/index.md）。
// 类型例外：`import type { EnvironmentStatus } from 'manim-live'` 编译后消失，不产生第二份运行时。
import {
  createManimRenderer,
  environmentStatus as coreEnvironmentStatus,
  onEnvironmentStatus as coreOnEnvironmentStatus,
  type EnvironmentStatus,
  type ManimRenderer,
  type Surface,
} from 'manim-live'
import { KATEX_ROUTE, PYODIDE_ROUTE } from '../routes.js'

export interface CheckResult {
  ok: boolean
  error?: string
  /** 不阻断渲染的提醒（如「代码含公式但公式样式没配」）；没有提醒时缺席。原样透传核心包的结论。 */
  warnings?: string[]
}

export interface ManimService {
  /** 干跑预检：语法错 / 未定义名 / manim-web 实测缺失项当场回 ok:false，调用方不必再自校验一份。 */
  check(python: string): Promise<CheckResult>
  /** 在给定容器里造一块 manim 画布；容器由调用方给、生命周期也由调用方管。 */
  createSurface(container: HTMLDivElement): Promise<Surface>
  /**
   * 环境状态快照：浏览器能力 / Pyodide 运行时 / KaTeX 样式 / 按需取包，四组条件加 `hints`。
   *
   * 是**本插件这一份**运行时与样式注入的读数（与实验场状态条、设置页那张卡同一份数据），
   * 不是调用方自己 import 核心包读出来的那份。不发起任何加载或探测请求，只读已发生的状态。
   */
  environmentStatus(): EnvironmentStatus
  /** 订阅环境状态变化；返回退订函数。调用方卸载时记得调。 */
  onEnvironmentStatus(cb: (status: EnvironmentStatus) => void): () => void
}

/**
 * 本插件全页唯一的渲染器实例。
 *
 * 为什么是**模块级单例**，而不是每次 `createManimService()` 新建一个：卡片
 * （`components/card.tsx`）与对外服务必须共用同一份——核心包的 WASM 运行时与串行执行队列
 * 本来就是**页面级单例**（见 `manim-live` 的 `py/runtime.ts`），造两个渲染器只会多插一份
 * KaTeX `<link>`、多记一份「谁造的画布」的账，没有半点好处。
 *
 * 懒建：本模块被 import 时不碰 DOM（核心包的工厂会注入 KaTeX 样式、登记 Pyodide 加载器），
 * 第一次真要渲染 / 真要 provide 服务时才建。
 */
let renderer: ManimRenderer | null = null

export function manimRenderer(): ManimRenderer {
  renderer ??= createManimRenderer({
    // 两条实际都指向本插件自己的 Host 路由——真源见 `src/routes.js`，与 Host 注册的是同一个值
    // （改一边忘一边的 404 从根上堵死）。核心包不知道使用者的资源挂在哪，所以这是**配置**，
    // 不是它写死的常量；想换 CDN / 自托管也只需改这一行。
    pyodideIndexURL: PYODIDE_ROUTE,
    katexBaseURL: KATEX_ROUTE,
  })
  return renderer
}

/**
 * 释放渲染器（插件卸载时调，之后 `manimRenderer()` 会重新建一个）。
 *
 * 核心包的 `dispose()` 会真释放 WASM / WebGL、拆掉本实例造过的所有画布、摘掉注入的 KaTeX 样式。
 * 这一步必须做——宿主不管这件事，漏一次就是一次内存泄漏（见顶层设计 §5 的「销毁契约」）。
 */
export function disposeManimRenderer(): void {
  renderer?.dispose()
  renderer = null
}

/**
 * 预热：把 Pyodide 本体与随包件（numpy 等，合计约 16 MB）先拉起来。
 *
 * 谁用：实验场状态条上那枚「立即预热」——不预热的话，第一次渲染要等它整段下载完，
 * 期间界面只有一个骨架屏。走的是与渲染同一条串行队列（见核心包 `py/runtime.ts` 的 queue），
 * 所以预热期间点渲染也不会两段同时初始化。
 */
export function warmupManim(): Promise<void> {
  return manimRenderer().warmup()
}

export function createManimService(): ManimService {
  const instance = manimRenderer()
  return {
    /** 干跑预检。**失败回 ok:false，不抛**——抛出去会把调用方一起带崩。 */
    check(python: string): Promise<CheckResult> {
      return instance.check(python)
    },
    createSurface(container: HTMLDivElement): Promise<Surface> {
      return instance.createSurface(container)
    },
    // 以下两条直接转发核心包的**模块级**函数，不经渲染器实例：环境状态不属于某块画布，
    // 而是整页共享的那一份运行时与样式注入——渲染器上本来也没有这两个方法。
    environmentStatus(): EnvironmentStatus {
      return coreEnvironmentStatus()
    },
    onEnvironmentStatus(cb: (status: EnvironmentStatus) => void): () => void {
      return coreOnEnvironmentStatus(cb)
    },
  }
}
