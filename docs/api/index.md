# API 参考：总览与入口

本页讲 dsh-manim-card 对外提供什么、怎么拿到、活多久。其余各页讲一个面：服务成员见[manim-card 服务](/api/service)，数据结构见[数据类型](/api/types)，模型侧的调用契约见[宿主工具](/api/tool)。

第一次上手看[它是什么](/guide/overview)与[安装](/guide/installation)；要在自己的插件里用画布，从[第三方插件接入](/guide/integrating)读起。

## 三条对外面

插件有四类使用者，接口按使用者分开，互不重叠：

| 使用者 | 接口 | 形态 | 文档 |
| --- | --- | --- | --- |
| 宿主里的模型 | `manim_render` 工具 | Host 工具，入参一段 Python 源码 | [宿主工具](/api/tool) |
| 其他插件 | `ctx.get('manim-card')` | Cordis 服务，返回 `ManimService` | 本页与[manim-card 服务](/api/service) |
| 聊天界面的使用者 | 卡片、实验场、设置面板 | 界面，无需编程 | [在聊天里用](/guide/usage)、[实验场](/guide/lab)、[设置面板](/guide/settings) |
| 本插件与核心包的开发者 | `pnpm` 脚本、`src/` 分层 | 源码 | [开发与调试](/dev/) |

**本插件不导出可供 `import` 的 JavaScript 模块。** 插件之间禁止 import 是宿主的约定，跨插件协作只有服务一条路；想在宿主之外使用同一块画布，直接依赖核心包 [manim-live](https://snowowowo.github.io/manim-live/)。

## 对象关系

一切从 `ctx.get('manim-card')` 开始。返回的 `ManimService` 就是调用方能拿到的全部：

```
ctx.get('manim-card')                     → ManimService | undefined   服务缺席时为 undefined
├─ check(python)                     → Promise<CheckResult>
├─ createSurface(container)          → Promise<Surface>           一块画布一个
│  ├─ run(code, handlers?)           → Promise<RunResult>         ← 以下五个成员属核心包
│  ├─ replay()                       → Promise<void>
│  ├─ canvas()                       → HTMLCanvasElement | null
│  ├─ isRendered()                   → boolean
│  └─ dispose()                      → void
├─ environmentStatus()               → EnvironmentStatus          快照
└─ onEnvironmentStatus(cb)           → () => void                 订阅，返回退订
```

三点读图说明：

- `ManimService` 的四个成员全是方法，没有属性。`Surface` 只能由 `createSurface()` 造出来，不能单独构造；它的成员定义与行为契约都在核心包，见[画布](https://snowowowo.github.io/manim-live/api/surface)。
- 服务面只覆盖「预检、画布、环境状态」三件事。卡片 UI、`manim_render` 工具、播放调度、实验场与导出都是本插件自己的入口，不在服务内——调用方要展示就得自建 UI。
- 状态有两个出口：单次运行的结论在 `check()` / `run()` 的返回值里，页面级的环境条件在 `environmentStatus()` 与它的订阅里，见[manim-card 服务](/api/service)。

## 拿到服务

服务由本插件的 Client 端在加载时 `provide`，调用方在自己的 `apply(ctx)` 里按需取用：

```js
// 你自己的插件 client.js
export default {
  inject: ['slots'],
  apply(ctx) {
    const manim = ctx.get('manim-card')
    if (!manim) return   // 软可选：本插件缺席时照常降级
    // …使用 manim
  },
}
```

**软可选消费**是本服务的硬约定：本插件未安装、被禁用或尚未加载时，`ctx.get('manim-card')` 返回 `undefined`。用 `ctx.get()` 而**不是** `inject`——`inject` 在宿主这版 Cordis 里是硬依赖，服务缺席会让整个插件不加载；本服务的语义是「有就用、没有就算了」，所以必须走 `get()`。

因此调用方需要保证：服务缺席时退化为自己的展示方式，不报错、不阻塞。反过来，本插件也不保证服务在任意时刻都存在——它在插件加载后出现，卸载时消失，见下文。

## 生命周期

| 时刻 | 发生什么 |
| --- | --- |
| 本插件加载 | 建立渲染器与宿主路由的接线，随后 `provide('manim-card')`；此后 `ctx.get('manim-card')` 可用 |
| 调用方建画布 | `createSurface()` 挂一块 WebGL 画布进你给的容器；容器不归本插件管 |
| 调用方用完 | 必须自己调 `surface.dispose()`：画布持有 WebGL 上下文，不释放就是泄漏 |
| 本插件卸载 | 先释放服务，再 `dispose()` 渲染器——**它造过的所有画布一并失效**，注入的 KaTeX 样式同时摘掉 |

最后一行是本服务最需要留意的一条：**本插件卸载后，调用方手上原有的 `Surface` 不再可用**。调用方若长期持有画布，应订阅服务变化并在服务消失时清理自己的容器；反之，本插件重新加载后拿到的是新服务，旧引用不会自动恢复。

```ts
// 服务只在「有」的时候用：每次取用前判断，不缓存跨生命周期的引用
const surface = await manim.createSurface(container)
// …使用…
surface.dispose()   // 不要留给本插件的 dispose 兜底
```

## 为什么状态必须走服务面

环境状态不是「重新算一遍就能得到的东西」，而是**本插件这一份运行时与样式注入的读数**。调用方若绕过服务、直接 `import 'manim-live'` 读状态，会得到一份错误的结果：

- 插件各自打包，调用方直接 import 会打进**第二份**核心包；
- 第二份里的运行时阶段、订阅表、Pyodide 单例都是**另一个实例**，读数恒为 `idle`；
- 真正在跑的那一份在本插件的 bundle 里，只有服务面能触到它。

症状是「不报错，只是永远显示未加载」——所以这不是风格问题，而是正确性问题。

**类型是例外**：`import type` 编译后完全消失，不产生第二份运行时。要用到类型定义时，把 `manim-live` 加进开发依赖，只取类型：

```ts
import type { EnvironmentStatus, CheckResult } from 'manim-live'
```

## 一条运行时，一条队列

本插件与调用方共享同一个页面级运行时：Python 解释器、WASM、串行执行队列都是页面级单例。因此

- 聊天卡片与调用方创建的画布不会争抢解释器，渲染按提交顺序串行执行；
- 某一方的代码长时间运行会阻塞另一方，这与「同一页面只有一条队列」是同一件事；
- 预热（实验场状态条上的动作）同样排在这条队列里，预热期间提交的渲染排在它后面。

画布的显示尺寸固定 1280×720，不随容器变化；要改显示大小用 CSS 缩放容器。背景全透明，底色由宿主页面透出。

## 从哪开始

- 想在自己的插件里用画布 → [第三方插件接入](/guide/integrating)
- 服务的四个成员逐个讲清 → [manim-card 服务](/api/service)
- `CheckResult` / `EnvironmentStatus` 等类型的字段 → [数据类型](/api/types)
- 模型调用 `manim_render` 的入参与返回 → [宿主工具](/api/tool)
