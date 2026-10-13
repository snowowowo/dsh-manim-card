# API 参考：数据类型

服务面涉及的类型分两半：本插件自己定义的只有 `ManimService` 与 `CheckResult`，其余（`Surface`、`RunResult`、`EnvironmentStatus` 及其子结构）由核心包 [manim-live](https://snowowowo.github.io/manim-live/) 定义并导出。本页给出每个类型的完整字段与取值语义；更细的行为说明在对应的方法页。

| 类型 | 定义方 | 用途 | 详解 |
| --- | --- | --- | --- |
| `ManimService` | 本插件 | 服务本身 | [manim-live 服务](/api/service) |
| `CheckResult` | 本插件 | `check()` 的返回 | [manim.check()](/api/service#manim-check-python) |
| `EnvironmentStatus` | 核心包 | 环境状态快照 | 本页 |
| `EnvironmentCapabilities` | 核心包 | 快照里的浏览器能力 | 本页 |
| `RuntimePhase` / `KatexPhase` | 核心包 | 两个生命周期阶段 | 本页 |
| `Surface` | 核心包 | 一块画布 | [核心包画布](https://snowowowo.github.io/manim-live/api/surface) |
| `RunResult` | 核心包 | 一次渲染的结论 | [核心包画布](https://snowowowo.github.io/manim-live/api/surface) |

## 类型从哪来

跨插件协作时，类型用**纯类型导入**取，运行时依赖一律走服务：

```ts
import type { CheckResult, EnvironmentStatus, Surface } from 'manim-live'
```

`import type` 编译后完全消失，不会打进第二份核心包，因此是安全的：它只用来给你自己那侧的代码做类型检查。**不要**在这个位置写值导入（`import { environmentStatus } from 'manim-live'`）——那会引入第二份运行时，读数与真实运行的那份脱节，见[总览](/api/#为什么状态必须走服务面)。

要用到这些类型，把 `manim-live` 加进自己插件的开发依赖（`devDependencies`）即可，它与本插件的运行时依赖是同一个包。

## CheckResult

`check()` 的返回。失败以数据表达，不以异常表达。

```ts
interface CheckResult {
  ok: boolean
  error?: string       // ok 为 false 时给出原因，带行号
  warnings?: string[]  // 不阻断渲染的提醒；没有提醒时缺席
}
```

| 字段 | 出现条件 | 含义 |
| --- | --- | --- |
| `ok` | 恒有 | 预检是否通过 |
| `error` | `ok` 为 `false` 时 | 可直接展示或回给模型的失败原文，带行号 |
| `warnings` | 有提醒时 | 不阻断渲染的问题，逐条一句话。改了写法或配置后消失 |

## EnvironmentStatus

环境状态快照，`environmentStatus()` 的返回，也是订阅回调收到的值。四个条件分量加一份建议列表：

```ts
interface EnvironmentStatus {
  capabilities: EnvironmentCapabilities
  runtime: { phase: RuntimePhase; error?: string; indexURL: string | null }
  katex: { baseURL: string | null; phase: KatexPhase; error?: string }
  packages: { fetching: string[]; lastError?: string }
  hints: string[]
}
```

### capabilities

浏览器能力的**一次性探测**结果，进程内缓存。它不随页面状态变化，只随浏览器环境变化（换机、换浏览器才会变）。

```ts
interface EnvironmentCapabilities {
  wasm: boolean
  webgl: boolean
  videoExport: boolean
}
```

| 字段 | 缺失的后果 |
| --- | --- |
| `wasm` | Python 解释器起不来，**所有**渲染不可用 |
| `webgl` | manim-web 出不了画面，**所有**渲染不可用 |
| `videoExport` | 只影响「浏览器逐帧导出」这一种导出方式，不影响渲染与本插件的 mp4 导出 |

### runtime

Pyodide 运行时的生命周期。

| 字段 | 含义 |
| --- | --- |
| `phase` | 见下表 |
| `error` | `phase` 为 `error` 时的失败原文 |
| `indexURL` | 当前登记的取数根。本插件始终用随包资源，指同源的插件路由；从未安装加载器时为 `null` |

| `phase` | 含义 | 可做什么 |
| --- | --- | --- |
| `idle` | 未加载。首次渲染前的正常初始状态 | 等，或用实验场的「立即预热」提前拉起 |
| `loading` | 正在加载 | 显示进度提示 |
| `ready` | 就绪，可渲染 | 正常调用 |
| `error` | 加载失败 | 看 `error`；`hints` 里已有对应建议 |

**`idle` 不是错误。** 它表示「还没有」而不是「出问题了」，据此出警示会误报。

### katex

`MathTex` / `Tex` 排出的公式所用的样式表状态。

| 字段 | 含义 |
| --- | --- |
| `baseURL` | 样式与字体所在目录；未配置时为 `null` |
| `phase` | 见下表 |
| `error` | `phase` 为 `error` 时的失败原文 |

| `phase` | 含义 |
| --- | --- |
| `unconfigured` | 创建渲染器时未给 `katexBaseURL`，本插件不注入样式。公式仍会渲染，但是无样式的裸排版 |
| `loading` | 样式表正在注入 |
| `loaded` | 已加载 |
| `error` | 样式表加载失败（`hints` 里会提示检查目录下有没有 `katex.min.css` 与字体文件） |

本插件始终配置 `katexBaseURL`，所以在宿主内这一项只会是 `loading` / `loaded` / `error`，不会出现 `unconfigured`。

### packages

按需取第三方 Python 包的进展（`import pandas` 这类随包没有、需要联网取一次的包）。

| 字段 | 含义 |
| --- | --- |
| `fetching` | 正在取的包名；不在取包时是空数组 |
| `lastError` | 最近一次取包失败的人话原因（含分档诊断的结论），成功一次后不再出现 |

### hints

**每个未满足项一句可执行的话**，全满足时是空数组。它只覆盖硬性未满足项：

- 缺 WASM / WebGL / MediaRecorder；
- 运行时启动失败；
- 公式样式加载失败；
- 取包失败。

「公式样式未配置」不在其中——那是配置选择而非故障，只在 `check()` 的 `warnings` 里出声。`hints` 里的句子可以直接展示给用户，本插件的实验场状态条与设置面板用的就是这几句。

```ts
const status = manim.environmentStatus()
if (status.hints.length > 0) showBanner(status.hints)
```

## Surface 与 RunResult

这两个类型属于核心包，本插件只做转交，字段与行为契约以核心包文档为准：

- `Surface`：一块画布，五个成员 `run` / `replay` / `canvas` / `isRendered` / `dispose`，都由 `createSurface()` 返回的实例上取。见[核心包：画布](https://snowowowo.github.io/manim-live/api/surface)。
- `RunResult`：一次渲染的结论 `{ ok, error?, cancelled? }`。注意 `cancelled` 为 `true` 表示画布已被销毁、这段代码没跑，**不是错误**，不应向用户显示任何内容。

```ts
const result = await surface.run(python)
if (result.cancelled === true) return
if (!result.ok) showError(result.error)
```
