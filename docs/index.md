---
layout: home

hero:
  name: dsh-manim-live
  text: 聊天里的 Manim 动画
  tagline: "DeepSeek Harness 插件：AI 在会话里写标准 Manim（Python）代码，聊天流中当场出现可播放的动画卡片——可重播、可看代码、可导出 mp4。代码在浏览器内执行，无需本机 Python。"
  actions:
    - theme: brand
      text: 安装
      link: /guide/installation
    - theme: alt
      text: 在聊天里用
      link: /guide/usage
    - theme: alt
      text: GitHub
      link: https://github.com/snowowowo/dsh-manim-live

features:
  - icon: 💬
    title: 动画卡片
    details: AI 调用 manim_render 工具提交代码，聊天流中出现 WebGL 画布的动画卡片；支持手动重播、查看源码、导出 mp4。
  - icon: 🩺
    title: 先预检再呈现
    details: 工具返回前干跑检查，语法错误与不支持写法当场报错，聊天里不会出现空白或残缺卡片。
  - icon: 🎛️
    title: 播放调度
    details: 新卡片进入视口时完整播放一次，重新挂载直接显示末帧；同一 step 并行产生的多张卡片只播放最后一张；全页共享一条 Python 执行队列。
  - icon: 🧪
    title: 实验场
    details: 内置样例集 + 自由代码的功能验收台：卡片渲染、播放控制、导出与预检报错逐项对照验收。
  - icon: ⚙️
    title: 设置面板
    details: 浏览器运行时（Python 运行时 / 公式样式 / WebGL / WASM）与本机 python3 / manim / ffmpeg 环境分两卡呈现；第三方库的本地缓存支持预缓存与删除。
  - icon: 🚦
    title: 环境状态
    details: 决定「能不能出画面、能不能导出」的四组条件收成一份可读的状态：实验场状态条、设置面板、聊天卡片同源，未满足项附可执行的处置。
  - icon: 🔌
    title: manim 服务
    details: 其他插件经 ctx.get('manim') 取用运行时与画布：干跑预检、创建画布、读环境状态、订阅状态变化；服务缺席时调用方不报错、不阻塞。
---

## 快速开始

1. 按[安装](/guide/installation)把插件装进 DeepSeek Harness 桌面版；
2. 在会话中说「用 Manim 画一个单位圆」——AI 提交 Python 代码后，聊天流中出现一张动画卡片，播放完成停留在终态画面。

## 全部章节

| 分组 | 章节 | 内容 |
| --- | --- | --- |
| 开始 | [它是什么](/guide/overview) | 定位、与原生 Manim 的差别、三方分工、与核心包 manim-live 的边界、能力清单 |
| 开始 | [安装](/guide/installation) | 前置条件、安装方式、随包资源、首次运行要等什么、哪些东西按需联网 |
| 开始 | [在聊天里用](/guide/usage) | 卡片的产生、自动播放规则、手动播放、查看代码、导出 mp4、环境不满足时的提示 |
| 功能 | [实验场](/guide/lab) | 内置样例集 + 自由代码的功能验收台，含四条条件的常驻状态条 |
| 功能 | [设置面板](/guide/settings) | 浏览器运行时、本机环境探测、Python 包缓存管理 |
| 接入 | [第三方插件接入](/guide/integrating) | 服务能给什么、怎么拿、最小可用例子、生命周期与释放、服务不提供什么 |
| API 参考 | [总览与入口](/api/) | 三条对外面、对象关系、拿到服务、为什么状态必须走服务面 |
| API 参考 | [manim 服务](/api/service) | 四个成员逐个：`check` / `createSurface` / `environmentStatus` / `onEnvironmentStatus` |
| API 参考 | [数据类型](/api/types) | `CheckResult`、`EnvironmentStatus` 及其子结构的完整字段与取值语义 |
| API 参考 | [宿主工具](/api/tool) | `manim_render` 的入参与返回、预检边界、配套注册的技能与常驻指引 |
| 开发 | [开发与调试](/dev/) | 源码分层、构建、测试、开发期安装、依赖核心包的方式、排障入口 |
