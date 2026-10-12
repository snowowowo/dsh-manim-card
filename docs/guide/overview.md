# 它是什么

本页给出 dsh-manim-live 的定位、运行链路上的三方分工、与核心包 manim-live 的边界，以及完整的能力清单。装好就用请直接看[安装](/guide/installation)与[在聊天里用](/guide/usage)。

## 一句话定位

dsh-manim-live 是 DeepSeek Harness（下称「宿主」）的插件：AI 在会话里写**标准 Manim（Python）代码**，聊天流中当场出现可播放、可查看代码、可导出 mp4 的动画卡片。

## 与原生 Manim 的差别

代码是同一份标准 Manim Python，差别只在「在哪里执行、如何产出画面」：

| | 原生 Manim（命令行） | 本插件 |
| --- | --- | --- |
| 写的代码 | 标准 Manim Python | 同一份代码，原样可跑 |
| 执行环境 | 本机装 Python + manim + ffmpeg（公式还要 LaTeX） | 浏览器内的 Pyodide，零本机安装 |
| 出画面方式 | 离线渲染成 mp4，播放与嵌入需另行解决 | 聊天流内实时渲染，即写即演 |
| 与讲解的配合 | 单次渲染需等整条管线跑完 | 进入视口即播放；预检先把有问题的代码拦在渲染之前 |
| 导出 mp4 | 命令行直接产出 | 复用本机 manim 命令行真渲染，产物落「下载」文件夹 |
| 部署成本 | 每台机器装一遍环境，或架渲染服务器 | 装一个插件；运行资源随包分发，不依赖外网 CDN |

可用面是 Manim CE 的常用子集，覆盖范围与缺失项以核心包[支持面](https://snowowowo.github.io/manim-live/guide/support)为准。

## 三方分工

从「AI 写代码」到「聊天里看到动画」，链路上有三方，各管一段：

| 参与方 | 负责 | 不负责 |
| --- | --- | --- |
| 宿主 | 会话与聊天流、槽位与服务体系、`manim_render` 的调用与日志 | 渲染、Manim 语法、本机环境 |
| 核心包 [manim-live](https://snowowowo.github.io/manim-live/) | 浏览器内的 Python 执行、manim 适配层、WebGL 画布、环境状态判定 | 宿主接入、卡片界面、导出、资源路由 |
| 本插件 | 宿主接入（路由、工具、槽位）、卡片与播放调度、实验场、设置面板、mp4 导出、跨插件服务 | 渲染与执行本身 |

三条对外面按使用者分开：给模型的是 [`manim_render` 工具](/api/tool)，给其他插件的是 [manim-live 服务](/api/service)，给人用的是聊天卡片与实验场。本插件不导出可供 `import` 的 JavaScript 模块——插件之间禁止 import 是宿主的约定。

## 与核心包 manim-live 的关系

[manim-live](https://github.com/snowowowo/manim-live)（[文档站](https://snowowowo.github.io/manim-live/)）是独立的 npm 包，执行与渲染的核心能力都在它那里；本插件是它在宿主里的接入层。按场景选择：

| 想要 | 用什么 |
| --- | --- |
| 在宿主会话里让 AI 画动画、看卡片、导出 mp4 | 本插件 |
| 在自己的页面或产品里嵌一块同样的画布，脱离宿主 | 核心包 manim-live |
| 在自己的插件里借用宿主内的那块画布与运行时 | 本插件的 [manim-live 服务](/guide/integrating) |
| 对一份语料做批量回归（239 条） | 核心包仓的 `corpus/`；本插件不维护语料 |

## 能力清单

| 能力 | 入口 | 说明 |
| --- | --- | --- |
| 动画卡片 | 聊天流 | AI 调用 `manim_render` 后出现；支持播放、查看源码、导出 mp4。见[在聊天里用](/guide/usage) |
| 干跑预检 | 工具内部 | 工具返回前在 Node 侧的真解释器里跑一遍，语法错、未定义名、不支持的写法当场以 `error` 回给模型。见[宿主工具](/api/tool) |
| 播放调度 | 插件内部 | 新卡片首次入视口完整播放一次、重新挂载落末帧、活跃画布超 8 张按距阅读位置回收、全页一条 Python 执行队列。见[在聊天里用](/guide/usage#自动播放规则) |
| 环境状态 | 实验场状态条、设置面板、`ctx.get('manim-live')` | 浏览器能力、运行时、公式样式、取包进展四组条件与可执行建议。见[实验场](/guide/lab#环境状态条) |
| 实验场 | 左侧导航「Manim 渲染」 | 内置样例集与自由代码的功能验收台。见[实验场](/guide/lab) |
| 设置面板 | 宿主设置「Manim 渲染」一节 | 浏览器运行时、本机环境探测、包缓存管理。见[设置面板](/guide/settings) |
| manim-live 服务 | `ctx.get('manim-live')` | 面向其他插件：预检、画布、环境状态快照与订阅。见[第三方插件接入](/guide/integrating) |

## 不适用

- 服务器端批量渲染视频：用 manim 命令行原生管线；本插件的预检与导出分别依赖宿主的 Node 侧运行时与本机命令行，都不面向批量产出。
- 脱离宿主的独立产品：直接依赖核心包 manim-live。
- Manim 全量能力：以核心包支持面为准。

## 从哪开始

- 装上并跑出第一张卡片 → [安装](/guide/installation)、[在聊天里用](/guide/usage)
- 验收插件功能是否正常 → [实验场](/guide/lab)
- 检查这台机器的条件（能不能出画面、能不能导出） → [设置面板](/guide/settings)
- 在自己的插件里用画布 → [第三方插件接入](/guide/integrating)，接口细节见 [API 参考](/api/)
