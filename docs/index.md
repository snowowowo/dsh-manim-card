---
layout: home

hero:
  name: dsh-manim-live
  text: 聊天里的 Manim 动画
  tagline: "DeepSeek Harness 插件：AI 在会话里写标准 Manim（Python）代码，聊天流中当场出现可播放的动画卡片——可重播、可查看代码、可导出 mp4。代码在浏览器内执行，不要求本机装 Python；约 13 MB 的运行时与公式字体随包分发，断网也能画基本图形。"
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
    details: AI 提交代码后，聊天流中出现一张卡片：一行标题、一块 WebGL 画布、右侧三个按钮（重播 / 查看源码 / 导出 mp4）。
  - icon: 🩺
    title: 先预检再呈现
    details: 代码先在 Node 侧的真解释器里跑一遍，语法错与不支持的写法当场回给模型；聊天里不会留下空白或残缺的卡片。
  - icon: 🎛️
    title: 播放调度
    details: 新卡片首次进入视口完整播放一次，此后重新挂载直接显示末帧；同一 step 并行产生的多张卡片只播最后一张。
  - icon: 🧪
    title: 实验场
    details: 左侧导航「Manim 渲染」下的一页：内置约十条样例加自由代码输入，每条样例旁边有通过 / 未通过的标记。
  - icon: ⚙️
    title: 设置面板
    details: 宿主设置「Manim 渲染」一节：浏览器运行时与本机 python3 / manim / ffmpeg 分两张卡列出，另有十一个常用第三方库的缓存清单，可缓存可删除。
  - icon: 🚦
    title: 环境状态
    details: 「能不能出画面、能不能导出」收成一份读数，实验场状态条、设置面板与聊天卡片三处同源；每一项未满足都附可执行的处置。
  - icon: 🔌
    title: manim-live 服务
    details: 其他插件经 ctx.get('manim-live') 取用预检、画布与环境状态；本插件缺席时调用方不报错、不阻塞。
---

## 一张卡片长什么样

在会话中向 AI 提出「用 Manim 绘制一个单位圆」，AI 通过 `manim_render` 工具提交一段 Python 代码，卡片随即出现在聊天流里。卡片的构成（示意）：

```
┌──────────────────────────────────────────────┐
│ Manim 动画                     ↻   ⟨⟩   ⤓   │  ← 重播 / 查看源码 / 导出 mp4
├──────────────────────────────────────────────┤
│                                              │
│        （1280×720 的 WebGL 画布）            │
│        播放完成后停在终态画面                │
│                                              │
└──────────────────────────────────────────────┘
```

- 卡片与实验场用的是**同一个组件**，所以手动播放、查看源码、导出这些能力在两边完全一致。
- 渲染前，代码先在 Node 侧的真解释器里干跑一遍；语法错误会以 `error` 回给模型并在同一回合修正，不会变成一张空白卡片。
- 出不了画面时，卡片底部会多出一行可执行的处置说明，见[在聊天里用](/guide/usage#环境不满足时的提示)。

## 装上

1. 按[安装](/guide/installation)把插件装进 DeepSeek Harness 桌面版；
2. 刷新宿主页面；
3. 在会话里说「用 Manim 画一个单位圆」。

## 全部章节

| 分组 | 章节 | 内容 |
| --- | --- | --- |
| 开始 | [它是什么](/guide/overview) | 定位、与原生 Manim 的差别、三方分工、与核心包 manim-live 的边界、能力清单 |
| 开始 | [安装](/guide/installation) | 前置条件、安装方式、随包资源、首次运行要等什么、哪些东西按需联网 |
| 开始 | [在聊天里用](/guide/usage) | 卡片的产生、自动播放规则、手动播放、查看代码、导出 mp4、环境不满足时的提示 |
| 功能 | [实验场](/guide/lab) | 内置样例集加自由代码的功能验收台，含四条条件的常驻状态条 |
| 功能 | [设置面板](/guide/settings) | 浏览器运行时、本机环境探测、Python 包缓存管理 |
| 接入 | [第三方插件接入](/guide/integrating) | 服务能给什么、怎么拿、最小可用例子、生命周期与释放、服务不提供什么 |
| API 参考 | [总览与入口](/api/) | 三条对外面、对象关系、拿到服务、为什么状态必须走服务面 |
| API 参考 | [manim-live 服务](/api/service) | 四个成员逐个：`check` / `createSurface` / `environmentStatus` / `onEnvironmentStatus` |
| API 参考 | [数据类型](/api/types) | `CheckResult`、`EnvironmentStatus` 及其子结构的完整字段与取值语义 |
| API 参考 | [宿主工具](/api/tool) | `manim_render` 的入参与返回、预检边界、配套注册的技能与常驻指引 |
| 开发 | [开发与调试](/dev/) | 技术栈、目录结构、开发流程、测试、装进宿主调试、排障入口 |
