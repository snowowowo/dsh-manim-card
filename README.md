# dsh-manim-card

给 DeepSeek Harness 加一个能力：**AI 在聊天里直接写 Manim 代码，当场在聊天流里出现一张可播放的动画卡片**——能手动播放、能查看代码、能导出成视频。

代码在浏览器内执行，**不要求本机装 Python**；运行时与公式字体随插件分发，不依赖公网 CDN，断网也能画基本图形。

> 线上文档（安装 / 在聊天里用 / 设置面板 / 开发与调试 / API 参考，中英双语）：<https://snowowowo.github.io/dsh-manim-card/>

## 特点

- **卡片就长在聊天流里**：一行标题、一块 1280×720 的 WebGL 画布，右侧三个按钮——手动播放 / 查看代码 / 导出视频。播放完停在终态画面，不会自己重来。
- **先预检，再呈现**：代码返回前先在真解释器里干跑一遍，语法错与不支持的写法当场回给模型并在同一回合修正——聊天里不会留下空白或残缺的卡片。
- **不要求本机 Python**：执行跑在浏览器内的真 CPython 上，随插件分发；第三方 Python 库按需取一次，之后离线命中。
- **播放有分寸**：只有刚生成的那张卡真播一遍；重新挂载与旧会话里的卡一律直接落终态，不让人对着动画干等。手动播放一键压过全部自动规则。
- **导出一个文件**：在浏览器里逐帧把这张卡导成一个视频文件——与卡片同一个渲染引擎，看到什么就导出什么，落到「下载」文件夹。
- **状态只有一份**：「能不能出画面、能不能导出」收成同一份读数，设置面板与聊天卡片两处一致，每一项未满足都附可执行的处置。

## 安装

| 方式 | 命令 |
| --- | --- |
| 从 npm | `dsh plugin add dsh-manim-card` |
| 从 tarball | `dsh plugin add ./dsh-manim-card-<版本>.tgz` |
| 从 GitHub 直装 | `dsh plugin add github:snowowowo/dsh-manim-card` |

装完刷新宿主页面，宿主设置里出现「Manim Card」一节。

前置条件只有宿主桌面版本身——WebGL 与 WebAssembly 由它的 WebView 提供。**本机 Python 不要求**，导出视频也在浏览器里完成；唯一需要联网的是「按需取第三方 Python 库」。细节见文档站的[安装](https://snowowowo.github.io/dsh-manim-card/guide/installation)。

## 用起来

在会话里说一句「用 Manim 画一个单位圆」，卡片随即出现在聊天流中。

自动播放的规则、查看代码、导出视频、出不来画面时的提示，见文档站的[在聊天里用](https://snowowowo.github.io/dsh-manim-card/guide/usage)。

## 开发

```bash
pnpm install
pnpm build      # 产出 client.js
pnpm watch      # 改 src/client 即重构建
pnpm test       # 单测（不联网那一档）
pnpm docs       # 本地起文档站
```

技术栈、目录结构、开发流程、测试分工与排障入口见文档站的[开发与调试](https://snowowowo.github.io/dsh-manim-card/dev/)。

## 边界

- **只做聊天流卡片这一件事**：装它一个就够用，不需要别的插件配合。
- 本仓只有两个半边——宿主的接线（`src/host/`，免构建的普通 JS）与本插件的界面（`src/client/`，打包成 `client.js`）。
- 导出视频走**浏览器**里逐帧编码（核心包自带的导出器），与卡片共用同一个渲染引擎，不需要本机装 manim 或 ffmpeg；浏览器缺这项能力时按钮置灰并说明缺什么，不影响画布上的动画。

## 许可

本项目依 **MIT** 授权，全文见 [LICENSE](./LICENSE)。

随包分发的运行资源与构建产物内联的第三方组件，各依其自身许可——清单见 [THIRD-PARTY.md](./THIRD-PARTY.md)。
