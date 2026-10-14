# 第三方插件接入

本页面向想在自己的插件里使用 Manim 运行时与画布的开发者：能拿到什么、怎么拿、什么时机释放，以及服务**不**提供什么。接口的逐条说明见 [API 参考](/api/)——本页只走一遍接入路径，不复述签名。

## 服务给什么

本插件对外提供 Cordis 服务 `manim-card`，返回一个 `ManimService`，四件事：

| 能力 | 方法 | 典型用途 |
| --- | --- | --- |
| 干跑预检 | `check(python)` | 在渲染前拦下语法错、未定义名、不支持的写法 |
| 造画布 | `createSurface(container)` | 在自己给的容器里渲染一段 Manim Python |
| 读环境状态 | `environmentStatus()` | 判断运行时是否就绪、有没有挡路的硬伤 |
| 订阅状态变化 | `onEnvironmentStatus(cb)` | 状态芯片、就绪那一刻的界面刷新 |

插件之间禁止 import，服务是唯一的协作面。除此之外本插件不导出任何可供 `import` 的 JavaScript 模块。

## 怎么拿到

在自己的 Client 端 `apply(ctx)` 里取，**软可选消费**：

```js
export default {
  inject: ['slots'],
  apply(ctx) {
    const manim = ctx.get('manim-card')
    if (!manim) return   // 本插件未安装 / 被禁用 / 尚未加载：退化为自己的展示方式
    // …使用 manim
  },
}
```

两点必须注意：

- 用 `ctx.get()` 而**不是** `inject`。在这版 Cordis 里 `inject` 是硬依赖，服务缺席会让你的插件整个不加载；本服务按定义是「有就用、没有就算了」，因此只能走 `get()`。
- 服务在插件加载后出现、卸载时消失，因此 `ctx.get()` 的结果**不要跨生命周期缓存**：每次取用前判断，或在服务消失时清理自己那一侧的引用。

## 最小可用例子

一段代码 → 预检 → 画布 → 渲染 → 释放，加上状态订阅：

```tsx
function Stage({ manim, python }: { manim: ManimService; python: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState('')

  // 先取初值，再订阅：订阅只播变化，不补播当前值
  const [phase, setPhase] = useState(() => manim.environmentStatus().runtime.phase)
  useEffect(() => manim.onEnvironmentStatus((s) => setPhase(s.runtime.phase)), [manim])

  useEffect(() => {
    let surface: Surface | null = null
    let dropped = false

    void (async () => {
      const checked = await manim.check(python)
      if (dropped) return
      if (!checked.ok) { setNote(checked.error ?? '预检未通过'); return }

      surface = await manim.createSurface(hostRef.current!)
      const result = await surface.run(python)
      if (dropped) return
      if (result.cancelled !== true && !result.ok) setNote(result.error ?? '渲染失败')
    })()

    // 释放归自己管：画布持有一份 WebGL 上下文
    return () => { dropped = true; surface?.dispose() }
  }, [manim, python])

  if (phase !== 'ready') return <p>运行时{phase === 'loading' ? '加载中' : '未就绪'}</p>
  return <div ref={hostRef}>{note && <p>{note}</p>}</div>
}
```

其中三处是契约而非风格：

- `check()` 失败以 `ok: false` 表达，**不抛异常**——它不会把你的调用链带崩，你也不必为它包 try。
- `result.cancelled === true` 表示画布已被销毁、这段代码没跑，**不是错误**，不该向用户显示任何内容。
- `surface.dispose()` 必须自己调。

## 状态从服务取，不要 import 核心包

要看环境状态，用 `manim.environmentStatus()`，**不要**自己 `import { environmentStatus } from 'manim-live'`。

原因是正确性：插件各自打包，直接 import 会打进第二份核心包，那份里的运行时阶段、订阅表与 Pyodide 单例都是另一个实例，读数恒为 `idle`——真正在跑的那一份在本插件的 bundle 里。症状是「不报错，只是永远显示未加载」。

**类型是例外**：`import type` 编译后消失，不产生第二份运行时。把 `manim-live` 加进自己插件的 `devDependencies`，只取类型：

```ts
import type { CheckResult, EnvironmentStatus, ManimService, Surface } from 'manim-live'
```

## 生命周期与释放

| 时刻 | 你的责任 |
| --- | --- |
| 服务缺席 | 退化为自己的展示方式，不报错、不阻塞 |
| 拿到画布 | 容器由你提供、内容由本插件写入；换场景时会清空容器内容 |
| 用完画布 | 自己调 `surface.dispose()`。不释放会耗尽浏览器可用的 WebGL 上下文 |
| 卸载组件 | 退订 `onEnvironmentStatus`；释放自己造过的画布 |
| 本插件卸载 | 服务消失，**它造过的所有画布一并失效**；你手上原有的 `Surface` 不再可用 |

运行时是**页面级单例**：你创建的画布与聊天卡片的画布共用同一条 Python 执行队列，因此不会出现两处争抢解释器，但反过来说，一方的长时间运行会阻塞另一方。

## 服务不提供什么

| 不提供 | 为什么 | 该怎么做 |
| --- | --- | --- |
| 卡片 UI、播放调度 | 本插件自有入口，界面形态与调用方的场景无关 | 自建 UI，用 `createSurface()` 渲染 |
| `manim_render` 工具 | 面向模型，不是面向插件 | 调用方自己决定何时生成代码 |
| 导出 mp4 | 依赖宿主与本机环境，不是通用能力 | 见核心包的[导出](https://snowowowo.github.io/manim-live/api/export)，或用宿主自己的文件能力 |
| `fast` 极速档、逐次取包回调 | 当前服务面只收容器一个参数，未开放 | 按[开发与调试](/dev/)扩 `src/client/service.ts`，不要绕过服务直接依赖核心包 |
| 预热 | 涉及约 16 MB 流量，何时花应由用户决定 | 引导用户到[实验场](/guide/lab#环境状态条)点「立即预热」 |

若目标是**脱离宿主**在自己的页面里用同一块画布，不必接入本服务——直接依赖核心包 [manim-live](https://snowowowo.github.io/manim-live/)。

## 接下去的阅读

- [API 参考：总览与入口](/api/)：对象关系、拿到服务的方式、生命周期
- [API 参考：manim-card 服务](/api/service)：四个成员逐个的参数、返回与边界
- [API 参考：数据类型](/api/types)：`CheckResult`、`EnvironmentStatus` 的全部字段
