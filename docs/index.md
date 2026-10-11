---
layout: home

hero:
  name: dsh-manim-live
  text: 在聊天里渲染 Manim 动画
  tagline: 一个 DeepSeek Harness 插件：AI 在对话中编写 Manim（Python）代码，聊天流中即时生成可播放的动画卡片——真实 Python 执行、WebGL 渲染，支持导出 mp4。安装即用，不依赖其他插件。
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
    title: 聊天流中的动画卡片
    details: AI 调用 manim_render 工具，聊天流中生成动画卡片：以 Pyodide 运行真实 Python，WebGL 画布播放，支持手动播放、查看代码与导出。
  - icon: 🩺
    title: 先预检再呈现
    details: 工具返回前先用空桥干跑一遍代码，语法错误、未定义名称、不支持的写法当场返回 error——呈现给用户的卡片不会白屏。
  - icon: 🎛️
    title: 受控的播放调度
    details: 仅新生成的卡片完整播放一次，重新挂载一律直接落至末帧；同一 step 并行产生的多张卡片只播放最后一张。全页共用一条 Python 队列与一个渲染调度器。
  - icon: 🧪
    title: 实验场
    details: 左侧导航「Manim 渲染」即实验场：19 组 / 236 条语料逐条运行，也可自由编写代码——同时也是插件的人工验收页面。

---

## 快速开始

将插件安装进 DeepSeek Harness 桌面版，在会话中说「用 Manim 画一个单位圆」——AI 生成 Python 代码后，聊天流中即出现一张动画卡片，播放完成停留在终态画面。

安装方式、运行所需环境与网络行为见[安装](/guide/installation)；播放规则、查看代码与导出 mp4 见[在聊天里用](/guide/usage)。

## 全部章节

| 章节 | 内容 |
| --- | --- |
| [安装](/guide/installation) | 安装插件、随包资源（Pyodide / KaTeX）、哪些功能需要联网或本机工具 |
| [在聊天里用](/guide/usage) | 卡片的产生、自动播放规则、手动播放、导出 mp4 |
| [实验场](/guide/lab) | 236 条语料的回归用例集：运行方式、极速档、通过判定 |
| [设置面板](/guide/settings) | 本机环境探测与 Python 包缓存管理 |
| [第三方插件接入](/guide/integrating) | `manim` 服务：`check(python)` 干跑预检 + `createSurface(container)` 创建画布 |
| [开发与调试](/dev/) | 面向本插件开发者：构建、测试、开发期安装、排障入口 |
