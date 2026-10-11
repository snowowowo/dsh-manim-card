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
    details: 独立页面逐条运行 236 条 Manim 语料（19 组），通过/失败即时标注，也可自由编写代码运行。
  - icon: ⚙️
    title: 设置面板
    details: 探测本机 python3 / manim / ffmpeg 环境（导出依赖），管理第三方库的本地缓存，支持预缓存与删除。
---

## 快速开始

1. 按[安装](/guide/installation)把插件装进 DeepSeek Harness 桌面版；
2. 在会话中说「用 Manim 画一个单位圆」——AI 提交 Python 代码后，聊天流中出现一张动画卡片，播放完成停留在终态画面。

## 全部章节

| 分组 | 章节 | 内容 |
| --- | --- | --- |
| 开始 | [它是什么](/guide/overview) | 一句话定位、三件事拆解、与核心包 manim-live 的关系、功能清单 |
| 开始 | [安装](/guide/installation) | 安装命令、随包资源（Pyodide / KaTeX）、哪些功能需要联网或本机工具 |
| 开始 | [在聊天里用](/guide/usage) | 卡片的产生、自动播放规则、手动播放、查看代码、导出 mp4 |
| 功能 | [实验场](/guide/lab) | 236 条语料的回归用例集：运行方式、极速档、通过判定 |
| 功能 | [设置面板](/guide/settings) | 本机环境探测与 Python 包缓存管理 |
| 接入 | [第三方插件接入](/guide/integrating) | manim 服务：check(python) 干跑预检 + createSurface(container) 创建画布 |
| 开发 | [开发与调试](/dev/) | 面向本插件开发者：构建、测试、开发期安装、排障入口 |
