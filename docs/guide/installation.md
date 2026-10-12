# 安装

本页覆盖前置条件、安装方式、随包资源与联网行为。插件是什么、与核心包 manim-live 的分工，见[它是什么](/guide/overview)。

## 前置条件

| 条件 | 说明 |
| --- | --- |
| DeepSeek Harness 桌面版 | 插件以宿主的槽位与服务体系接入，离开宿主没有意义 |
| **WebGL** | 画布用 three.js 渲染，没有它出不了任何画面 |
| **WebAssembly** | Pyodide 跑真 CPython 的基础，没有它所有渲染都起不来 |
| 本机 Python | **不要求**。执行发生在浏览器内的 Pyodide |

宿主桌面版自带的 WebView 满足 WebGL 与 WebAssembly 两项；这两项在设置面板的「浏览器运行时」卡里可以直接看到探测结果，见[设置面板](/guide/settings#浏览器运行时)。

只有两处会碰本机，都与渲染无关：

- **导出 mp4**：要本机装的 `manim` 命令行与 `ffmpeg`。缺什么，设置面板与导出按钮都会明说，见[在聊天里用](/guide/usage#导出-mp4)。
- **第三方 Python 库按需取**（`import pandas` 这类）：首次联网取一次，之后离线命中，见下文。

## 安装方式

任选其一，在宿主的 CLI / 插件管理里执行：

```bash
# 从 npm（发布后可用）
dsh plugin add dsh-manim-live

# 从 tarball
dsh plugin add ./dsh-manim-live-<版本>.tgz

# 从 GitHub 仓库直装（仓根即包）
dsh plugin add github:snowowowo/dsh-manim-live
```

::: tip 未实测项
npm 发布与 GitHub 直装两条链路尚未走通验证过（仓库当前私有）。开发期的装法（软链 + patch 条目 + HMR）见[开发与调试](/dev/)。落地后会更新本页。
:::

## 随包资源

两份运行资源随插件分发，装完不需要另外准备，也不依赖外网 CDN：

| 资源 | 位置 | 用途 |
| --- | --- | --- |
| Pyodide 发行版 | `assets/pyodide/` | 核心 wasm + 标准库 + numpy / sympy / mpmath。断网也能画基本图形 |
| KaTeX 样式与字体 | `assets/katex/` | `MathTex` / `Tex` 排出的公式所需 |

两者都由插件的 Host 路由**同源分发**：浏览器侧不直连公网，取数根就是插件自己的路由。

## 首次运行要等什么

首次渲染前需要把 Pyodide 本体（约 13 MB）与随包的 numpy（约 3 MB）取进浏览器，期间界面只有骨架屏。这段等待可以提前：

- 在实验场状态条上点「立即预热」，见[实验场](/guide/lab#环境状态条)；
- 或直接看设置面板「浏览器运行时」卡里的 Python 运行时一行，它会给出当前阶段。

## 哪些东西按需联网

`import pandas` 这类**随包没有的第三方库**：首次用到时联网取一次，按 sha256 校验后落进 `~/.dsh/cache/manim-live/pyodide/`，之后离线命中。取值期间卡片上会提示「正在加载 X…」，结果同时反映在环境状态的取包一项里。

想提前存好或清掉，去设置面板的「包缓存」一块，见[设置面板](/guide/settings#包缓存)。断网环境下未缓存过的库取不到，此时渲染会以取包失败报错，错误原因与环境状态里 `packages.lastError` 是同一句。
