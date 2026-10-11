# 第三方插件接入

本插件对外提供一个服务 `manim`：**运行时 + 一块画布**。别的插件经 `ctx.get('manim')` 拿到它——插件之间禁止 import，这是唯一的协作面。

**软可选消费**：服务缺席（本插件没装 / 被禁用）时调用方退化成「没有画布」，**不报错、不阻塞**：

```js
// client.js 的 apply(ctx) 里：
const manim = ctx.get('manim')
if (manim) {
  // 用它；没有就降级成你自己的展示方式
}
```

## 服务接口

就两件事：

```ts
interface ManimService {
  /** 干跑预检：语法错 / 未定义名 / 写法不支持，当场回 ok:false——调用方不必再自校验一份。 */
  check(python: string): Promise<{ ok: boolean; error?: string }>
  /** 在给定容器里造一块 manim 画布；容器由调用方给、生命周期也由调用方管。 */
  createSurface(container: HTMLDivElement): Promise<Surface>
}
```

- **`check()` 失败回 `ok:false`，不抛**——抛出去会把调用方一起带崩。
- **`createSurface()` 返回的 `Surface` 用完要 `dispose()`**：画布背后是一份 WebGL 上下文，真释放（详见核心包 [manim-live 的契约文档](https://snowowowo.github.io/manim-live/guide/contracts)）。
- 运行时是**页面级单例**：你造的画布与聊天卡片的画布共用同一条 Python 执行队列，不会有两张卡抢解释器。

## 不在这里的东西

卡片 UI、Host 工具（`manim_render`）、播放调度都是本插件自己的入口，服务里没有——调用方要做自己的 UI，用 `createSurface()` 自己画。若要脱离宿主用画布，直接依赖核心包 [manim-live](https://snowowowo.github.io/manim-live/)。
