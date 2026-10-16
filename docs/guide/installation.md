# 安装

本页覆盖前置条件、安装方式、随包资源与联网行为。插件是什么、与核心包 manim-live 的分工见[它是什么](/guide/overview)；装完怎么用见[在聊天里用](/guide/usage)。

## 前置条件

| 条件 | 说明 |
| --- | --- |
| DeepSeek Harness 桌面版 | 插件以宿主的槽位与服务体系接入，离开宿主没有意义 |
| **WebGL** | 画布用 three.js 渲染，没有它出不了任何画面 |
| **WebAssembly** | Pyodide 跑真 CPython 的基础，没有它所有渲染都起不来 |
| 本机 Python | **不要求**。执行与导出都发生在浏览器内 |
| WebCodecs 或 MediaRecorder | **渲染不要求**。只有「在浏览器里导出视频」需要；缺了按钮置灰并说明缺什么，画面照画 |

宿主桌面版自带的 WebView 满足 WebGL 与 WebAssembly 两项；这两项在设置面板的「浏览器运行时」卡里直接显示探测结果，见[设置面板](/guide/settings#浏览器运行时)。

渲染与导出都在浏览器里完成，**本机不需要装任何东西**。唯一会碰到网络的是**第三方 Python 库按需取**（`import pandas` 这类）：首次联网取一次，之后离线命中，见下文。

## 安装方式

在宿主的 CLI / 插件管理里任选其一：

| 方式 | 命令 | 状态 |
| --- | --- | --- |
| 从 npm | `dsh plugin add dsh-manim-card` | 尚未发布 |
| 从 tarball | `dsh plugin add ./dsh-manim-card-<版本>.tgz` | 本地 `npm pack` 出包后可用 |
| 从 GitHub 仓库直装 | `dsh plugin add github:snowowowo/dsh-manim-card` | 仓库已公开，链路未实测 |

::: tip 两条链路尚未实测
仓库已公开，线上文档站也已上线；但 **npm 发布**与 **GitHub 直装**两条链路尚未端到端走通，落地后会更新本页。开发期的装法是 profile 内软链加 patch 条目，见[开发与调试](/dev/)。
:::

装完后刷新宿主页面，**宿主设置**里出现「Manim Card」一节。

## 随包资源

两类运行资源随插件分发，装完不需要另外准备，也不依赖外网 CDN：

| 资源 | 位置 | 用途 |
| --- | --- | --- |
| Pyodide 发行版 | `assets/pyodide/` | 核心 wasm + 标准库 + numpy / sympy / mpmath 三个 wheel。断网也能画基本图形 |
| KaTeX 样式与字体 | `assets/katex/` | `MathTex` / `Tex` 排出的公式所需 |

两者都由插件的 Host 路由**同源分发**：浏览器侧不直连公网，取数根就是插件自己的路由。

本插件的运行时依赖（核心包 `manim-live`）同样不打搅你——它在构建时**内联**进 `client.js`，不需要单独安装，也不是一份要自己准备的资源。

## 首次运行要等什么

首次渲染前需要把 Pyodide 本体（约 13 MB）与随包的 numpy（约 3 MB）取进浏览器，期间界面只有骨架屏。这段等待可以提前看出进度：

- 看设置面板「浏览器运行时」卡里的 Python 运行时一行，它会给出当前阶段。

## 哪些东西按需联网

`import pandas` 这类**随包没有的第三方库**：首次用到时联网取一次，按 sha256 校验后落进 `~/.dsh/cache/manim-live/pyodide/`，之后离线命中。取值期间卡片上提示「正在加载 X…」；失败则进「浏览器运行时」卡片底部的处置句。

想提前存好或清掉，去设置面板的「Python 库」一块，见[设置面板](/guide/settings#python-库)。断网环境下未缓存过的库取不到，此时渲染以取包失败报错，错误原因与环境状态里 `packages.lastError` 是同一句。

## 卸载

- **开发期软链装的**：删掉 profile 里的软链与 `cordis.patch.yml` 中本插件那一行。
- **CLI 或市场装的**：按宿主的插件管理卸载。

缓存目录 `~/.dsh/cache/manim-live/pyodide/` 在插件目录之外，卸载插件不会动它；要回收空间就手动删这个目录。

## 下一步

- 在会话里跑出第一张卡片 → [在聊天里用](/guide/usage)
- 检查这一页的浏览器条件 → [设置面板](/guide/settings)
