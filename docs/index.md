---
layout: home

hero:
  name: dsh-manim-live
  text: 在聊天里渲染 Manim 动画
  tagline: 一个 DeepSeek Harness 插件：AI 在对话里直接写 Python 的 Manim 代码，聊天流里当场长出一张可播放的动画卡片——真 Python 执行、WebGL 出画面、还能导出 mp4。装上就能用，不依赖其他插件。
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
    title: 聊天流里的动画卡片
    details: AI 调 manim_render 工具 → 聊天流里出一张卡：真 Python（Pyodide）跑 AI 写的 Manim 代码，WebGL 画布播放，附手动播放 / 查看代码 / 导出。
  - icon: 🩺
    title: 先预检再上台
    details: 工具返回前用空桥干跑一遍，语法错、未定义名、写法不支持当场回 error——放给用户的卡不会白屏。
  - icon: 🎛️
    title: 播放不吵不漏
    details: 只有「刚生成的那张」正常播一遍，重挂载一律极速落末帧；同一个 step 并行发的几张只播最后一张。全页共用一条 Python 队列与一个渲染调度器。
  - icon: 🧪
    title: 实验场
    details: 左侧导航「Manim 渲染」就是实验台：19 组 / 236 条语料点哪条跑哪条，也能自由写代码——它同时是插件的肉眼验收台。

---

## 怎么开始

装进 DeepSeek Harness 桌面版，开个会话直接说「用 Manim 画个单位圆」——AI 写好 Python，聊天流里就长出一张动画卡片，播放完停在终态画面。

装法、运行所需的环境与网络行为见[安装](/guide/installation)；播放规则、查看代码与导出 mp4 见[在聊天里用](/guide/usage)。

## 全部章节

| 章节 | 讲什么 |
| --- | --- |
| [安装](/guide/installation) | 装插件、随包资源（Pyodide / KaTeX）、哪些功能需要联网或本机工具 |
| [在聊天里用](/guide/usage) | 卡片怎么长出来、自动播的规则、手动播放、导出 mp4 |
| [实验场](/guide/lab) | 236 条语料的回归网：怎么跑、极速档、「通过」怎么判 |
| [设置面板](/guide/settings) | 本机环境探测（导出要靠谁）+ Python 包缓存与预缓存 |
| [第三方插件接入](/guide/integrating) | `manim` 服务：`check(python)` 干跑预检 + `createSurface(container)` 造画布 |
