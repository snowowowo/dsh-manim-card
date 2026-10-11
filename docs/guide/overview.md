# 它是什么

本页给出 dsh-manim-live 的定位、运行链路上的三方分工、与核心包 manim-live 的关系和功能清单。只想装好就用，直接看[安装](/guide/installation)与[在聊天里用](/guide/usage)。

## 一句话定位

dsh-manim-live 是 DeepSeek Harness（下称「宿主」）的插件：AI 在会话里写 Manim（Python）代码，聊天流里当场出现可播放的动画。

## 三件事拆解

从「AI 写代码」到「聊天里看到动画」，链路上有三方，各管一段：

- **宿主提供会话与聊天流**——AI 在这里产出代码，动画卡片也出现在这里；插件以宿主的 slot / 服务机制接入，离开宿主没有意义。
- **核心包 manim-live 提供画布与执行**——Pyodide 运行时（浏览器内跑真 CPython）、manim 适配层、支持面与 WebGL 画布都在这个独立 npm 包里。
- **本插件做宿主接入与功能层**——Host 路由同源分发随包资源（Pyodide / KaTeX），注册 `manim_render` 工具与卡片 UI，并在核心包之上实现预检、播放调度、实验场与 mp4 导出。

## 与核心包 manim-live 的关系

[manim-live](https://github.com/snowowowo/manim-live)（[文档站](https://snowowowo.github.io/manim-live/)）是独立的 npm 包，执行与渲染的核心能力都在它那里；本插件是它在宿主里的接入层。按使用场景选择：

- 想在宿主会话里让 AI 画动画、看卡片、导出 mp4——用本插件；
- 想脱离宿主、在自己的页面里用同一块画布——直接依赖核心包 manim-live，参阅其文档。

## 功能清单

| 功能 | 入口 | 说明 |
| --- | --- | --- |
| 动画卡片 | 聊天流 | AI 调用 `manim_render` 提交代码后出现；支持播放、查看源码、导出 mp4，详见[在聊天里用](/guide/usage) |
| 干跑预检 | 工具内部 | 工具返回前检查代码，语法错误、未定义名称、不支持的写法当场返回 `error` |
| 播放调度 | 插件内部 | 新卡片完整播放一次、重新挂载落末帧、活跃画布超 8 张按距阅读位置回收、全页一条 Python 执行队列 |
| 实验场 | 左侧导航「Manim 渲染」 | 19 组 / 236 条语料逐条运行，也可自由编写代码，详见[实验场](/guide/lab) |
| 设置面板 | 宿主设置「Manim 渲染」一节 | 本机环境探测与 Python 包缓存管理，详见[设置面板](/guide/settings) |
| manim 服务 | `ctx.get('manim')` | 面向其他插件：check(python) 干跑预检 + createSurface(container) 创建画布，详见[第三方插件接入](/guide/integrating) |
