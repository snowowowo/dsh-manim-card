---
layout: home

hero:
  name: dsh-manim-card
  text: 聊天里的 Manim 动画
  tagline: "DeepSeek Harness 插件：AI 在会话里写标准 Manim（Python）代码，聊天流中当场出现可播放的动画卡片——可手动播放、可查看代码、可导出视频。代码在浏览器内执行，不要求本机装 Python；运行时与公式字体随包分发（首次加载约 13 MB），断网也能画基本图形。"
  actions:
    - theme: brand
      text: 安装
      link: /guide/installation
    - theme: alt
      text: 在聊天里用
      link: /guide/usage
    - theme: alt
      text: GitHub
      link: https://github.com/snowowowo/dsh-manim-card

features:
  - icon: 💬
    title: 动画卡片
    details: AI 提交代码后，聊天流中出现一张卡片：一行标题、一块 WebGL 画布、右侧三个按钮（手动播放 / 查看代码 / 导出视频）。
  - icon: 🩺
    title: 先预检再呈现
    details: 代码先在 Node 侧的真解释器里跑一遍，语法错与不支持的写法当场回给模型；聊天里不会留下空白或残缺的卡片。
  - icon: 🚦
    title: 环境状态
    details: 「能不能出画面、能不能导出」收成一份读数，设置面板与聊天卡片两处同源；每一项未满足都附可执行的处置。
---

## 一张卡片长什么样

在会话中向 AI 提出「用 Manim 绘制一个定积分」，AI 通过 `manim_card` 工具提交一段 Python 代码，卡片随即出现在聊天流里：

![聊天流中的 Manim 动画卡片：标题行、1280×720 画布，右侧三个按钮](./shots/card-preview.png)

- 卡片顶栏是标题与三个按钮（手动播放 / 查看代码 / 导出视频），下方是 1280×720 的 WebGL 画布，播放完成后停在终态画面。
- 渲染前，代码先在 Node 侧的真解释器里干跑一遍；语法错误会以 `error` 回给模型并在同一回合修正，不会变成一张空白卡片。
- 出不了画面时，卡片底部会多出一行可执行的处置说明，见[在聊天里用](/guide/usage#环境不满足时的提示)。

## 装上

1. 按[安装](/guide/installation)把插件装进 DeepSeek Harness 桌面版；
2. 刷新宿主页面；
3. 在会话里说「用 Manim 画一个单位圆」。
