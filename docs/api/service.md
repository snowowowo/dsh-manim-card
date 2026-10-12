# API 参考：manim 服务

服务 `manim` 由本插件的 Client 端提供，其他插件经 `ctx.get('manim')` 取用。它有一个对象 `ManimService`、四个方法：预检、建画布、读环境状态、订阅环境状态变化。本页逐个讲清。怎么拿到服务、生命周期与协作边界见[总览](/api/)，类型字段见[数据类型](/api/types)。

```ts
interface ManimService {
  check(python: string): Promise<CheckResult>
  createSurface(container: HTMLDivElement): Promise<Surface>
  environmentStatus(): EnvironmentStatus
  onEnvironmentStatus(cb: (status: EnvironmentStatus) => void): () => void
}
```

四个方法都是**同步返回或返回 Promise，不抛异常**：`check()` 的失败以 `ok: false` 表达，`createSurface()` 的失败以 Promise reject 表达（建画布涉及 WebGL，失败无法用返回值表达）。

## manim.check(python)

干跑预检：代码在真解释器里被执行一遍，只是不产出画面。拦下语法错误、未定义的名字、manim-web 实测缺失的能力三类问题。

```ts
check(python: string): Promise<CheckResult>

interface CheckResult {
  ok: boolean
  error?: string       // ok 为 false 时给出原因，带行号
  warnings?: string[]  // 不阻断渲染的提醒；没有提醒时缺席
}
```

**参数** `python`：待检查的 Manim Python 源码。完整文件（`from manim import *` 加 `class X(Scene)`）与只写 `construct` 体内的语句两种形态都收。

**返回** `Promise<CheckResult>`。`ok` 为 `true` 表示预检通过；为 `false` 时 `error` 是可直接展示或回给模型的原文。

**例子**

```ts
const manim = ctx.get('manim')
if (!manim) return

const result = await manim.check(python)
if (!result.ok) {
  render(result.error)   // 直接展示：错误已带行号与原因
  return
}
if (result.warnings?.length) showHint(result.warnings)
// …继续建画布、渲染
```

**注意**

- **失败回 `ok: false`，不抛异常**。抛出去会把调用方一起带崩——服务缺席时反而比服务在位更糟，所以这条不能破。
- 预检要在真解释器里跑，因此首次调用会一并拉起 Pyodide 运行时（若尚未加载），可能等待一次运行时下载。要在渲染前把等待提前，先调 `environmentStatus()` 看 `runtime.phase`，或让用户走实验场状态条上的「立即预热」。
- 源码为空（去掉首尾空白后长度为 0）时直接返回 `{ ok: true }`，不启动运行时。
- **预检不保证渲染成功**：它跑的是「什么都不画」的桥，涉及真实绘制与布局的错误要到 `Surface.run()` 才暴露。渲染期错误由调用方自己承接。
- `warnings` 只报不阻断的问题（典型是「代码含公式而创建渲染器时未配置公式样式」），不改变 `ok` 判定。
- 同一页面同时只有一段代码在跑：预检与渲染共用一条串行队列，见[总览](/api/#一条运行时-一条队列)。

## manim.createSurface(container)

在给定容器里建一块 manim 画布并返回它。

```ts
createSurface(container: HTMLDivElement): Promise<Surface>
```

**参数** `container`：画布的容器元素。由调用方提供，生命周期也由调用方管理——本插件只往里挂 canvas，不创建、不移动、不销毁容器。

**返回** `Promise<Surface>`。返回 Promise 是因为建画布要先加载 manim-web 并创建 WebGL 场景，这一步有真实耗时。`Surface` 的五个成员（`run` / `replay` / `canvas` / `isRendered` / `dispose`）属于核心包，定义与行为契约见[画布](https://snowowowo.github.io/manim-live/api/surface)。

**例子**

```ts
const stage = document.querySelector('#stage') as HTMLDivElement
const surface = await manim.createSurface(stage)

const result = await surface.run(python)
if (!result.ok) console.error(result.error)

// 用完必须释放：画布持有一份 WebGL 上下文
surface.dispose()
```

**注意**

- **必须自己调 `dispose()`**。画布持有 WebGL 上下文，浏览器同时可用的上下文数量有上限；不释放会让页面后续建不出新画布。本插件卸载时也会 `dispose()` 自己造过的所有画布，但那不该被当作兜底。
- 容器里的内容在换场景时会被清空（`replay()`，或代码里出现 3D 场景）。不要在容器里放需要保留的其它元素。
- 画布分辨率固定 1280×720，不随容器尺寸变化；要改显示大小用 CSS 缩放容器，坐标系不受影响。
- 同一页面的画布共享一个解释器与一条执行队列：调用方的画布与聊天卡片的画布不会同时播放。
- 服务面只收容器一个参数。`SurfaceOptions`（`fast` 极速档、这块画布上 `run` 的默认 `onLoading`）与导出接入者属于本插件的内部能力，未在此开放；确有需要时按[开发与调试](/dev/)的方式在 `src/client/service.ts` 上扩，**不要**绕过服务直接依赖核心包——原因见[为什么状态必须走服务面](/api/#为什么状态必须走服务面)。

## manim.environmentStatus()

环境状态快照：四组「决定能不能出画面」的运行期条件，加一份可执行的建议列表。不发起任何加载或探测请求，只读已经发生的状态。

```ts
environmentStatus(): EnvironmentStatus
```

**返回** `EnvironmentStatus`，四个分量：

| 字段 | 含义 |
| --- | --- |
| `capabilities` | 浏览器能力：`wasm`（Python 解释器的基础）、`webgl`（出画面的出口）、`mediaRecorder`（只影响浏览器录屏导出） |
| `runtime` | Pyodide 运行时：`phase`（`idle` / `loading` / `ready` / `error`）、`error`、`indexURL`（当前取数根） |
| `katex` | 公式样式：`baseURL`、`phase`（`unconfigured` / `loading` / `loaded` / `error`）、`error` |
| `packages` | 按需取包：`fetching`（正在取的包名）、`lastError`（最近一次失败的人话原因） |
| `hints` | 每个未满足项一句可执行的话；全满足时是空数组 |

字段逐条的取值与语义见[数据类型](/api/types#environmentstatus)。

**例子**

```ts
const status = manim.environmentStatus()

// 常见的用法一：未就绪时不出画面，先给一句话
if (status.runtime.phase !== 'ready') {
  renderPlaceholder(status.hints.length ? status.hints : ['运行时尚未加载'])
  return
}

// 常见的用法二：只在有硬性未满足项时警示
if (status.hints.length > 0) showBanner(status.hints)
```

**注意**

- **读到的必须是本插件这一份的读数**：这正是它走服务面而不是由调用方 import 核心包的原因，见[总览](/api/#为什么状态必须走服务面)。
- 快照不代替动作：它只回答「现在什么状态」。`idle` 与 `unconfigured` 都不是错误，是「还没有」。
- 能力探测只算一次并缓存，开销可忽略。
- `hints` 只放硬性未满足项（缺能力、运行时或公式样式加载失败、取包失败）。「公式样式未配置」是配置选择，只出现在 `check()` 的 `warnings` 里。

## manim.onEnvironmentStatus(cb)

订阅环境状态变化：运行时阶段、公式样式加载结果、取包进展任一变动都播一次最新快照。返回退订函数。

```ts
onEnvironmentStatus(cb: (status: EnvironmentStatus) => void): () => void
```

**参数** `cb`：收到最新快照。回调自己抛错时本插件用 `console.error` 记一条，不影响其余订阅者。

**返回** `() => void`：退订。**调用方卸载时必须调用**——订阅表活在本插件的 bundle 里，不退订就是让已卸载的组件继续被回调。

**例子**

```ts
// 典型的用法：状态芯片随运行时就绪自动刷新
const unsubscribe = manim.onEnvironmentStatus((status) => {
  setRuntimePhase(status.runtime.phase)
  setFetching(status.packages.fetching)
})

return unsubscribe   // 交给调用方的清理时机
```

**注意**

- 播报是**同步的**：回调在与状态迁移同一次同步流程里被调用，不要在回调里做重活或再次触发渲染。
- 订阅只播**变化**，不补播当前值。拿到服务后先 `environmentStatus()` 取一次初值，再订阅，否则两次变化之间的状态会漏掉。
- 与 `Surface.run()` 的逐次回调并存且不冲突：那些挂在单次调用上，这个挂在页面级状态上。
