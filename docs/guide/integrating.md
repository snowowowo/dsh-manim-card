# 第三方插件接入

本页面向想在自己的插件里使用 Manim 运行时与画布的开发者。本插件对外提供服务 `manim`：**运行时 + 画布**。其他插件经 `ctx.get('manim')` 获取——插件之间禁止 import，服务是唯一的协作面。

**软可选消费**：服务缺席（本插件未安装或被禁用）时，调用方退化为「没有画布」，**不报错、不阻塞**：

```js
// client.js 的 apply(ctx) 里：
const manim = ctx.get('manim')
if (manim) {
  // 使用服务；缺席时降级为自己的展示方式
}
```

## 服务接口

```ts
interface ManimService {
  /** 干跑预检：语法错 / 未定义名 / 写法不支持时回 ok:false——调用方无需自行校验。 */
  check(python: string): Promise<{ ok: boolean; error?: string }>
  /** 在给定容器里创建一块 manim 画布；容器由调用方提供，生命周期也由调用方管理。 */
  createSurface(container: HTMLDivElement): Promise<Surface>
}
```

- **`check()` 失败返回 `ok:false`，不抛异常**——抛出会导致调用方一并崩溃。
- **`createSurface()` 返回的 `Surface` 使用完毕须调用 `dispose()`**：画布持有一份 WebGL 上下文，需要真实释放（详见核心包 [manim-live 的契约文档](https://snowowowo.github.io/manim-live/guide/contracts)）。
- 运行时是**页面级单例**：调用方创建的画布与聊天卡片的画布共用同一条 Python 执行队列，不会出现多张卡争抢解释器的情况。

## 服务不包含的内容

卡片 UI、Host 工具（`manim_render`）、播放调度均为本插件自有入口，不在服务内——调用方需自建 UI，用 `createSurface()` 自行渲染。若要在宿主之外使用画布，直接依赖核心包 [manim-live](https://snowowowo.github.io/manim-live/)。
