# 安装

本页覆盖安装命令、随包资源与联网行为——装完即用。插件是什么、与核心包 manim-live 的分工，见[它是什么](/guide/overview)。

## 前置条件

- **DeepSeek Harness 桌面版**：插件以宿主的 slot / 服务机制接入，离开宿主没有意义。
- 浏览器侧要有 **WebGL**（画布用 three.js 渲染）与 **WebAssembly**（Pyodide 跑真 CPython）——宿主桌面版自带的 WebView 满足这两项。
- 基础功能**不要求本机装 Python**：执行发生在浏览器里的 Pyodide。只有两处碰本机：
  - **导出 mp4**：要本机装的 `manim` 命令行 + `ffmpeg`（缺什么，设置面板与导出按钮都会明说）；
  - **第三方 Python 库按需取**（`import pandas` 这类）：首次联网取一次，之后离线命中，见下文。

## 安装命令

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
npm 发布与 GitHub 直装两条链路尚未走通验证过（仓库当前私有）。当前开发期的装法（软链 + patch 条目 + HMR）见[开发与调试](/dev/)。落地时会更新本页。
:::

## 随包资源，不用另配

- **Pyodide 发行版随包**（`assets/pyodide/`）：核心 wasm + 标准库 + numpy / sympy / mpmath——装完插件，断网也能画基本图形。
- **KaTeX 样式与字体随包**（`assets/katex/`）：`MathTex` 公式渲染用。
- 两者都由插件的 Host 路由同源分发，不依赖外网 CDN。

## 哪些东西按需联网

`import pandas` 这类**随包没有的第三方库**：首次用到时联网取一次，按 sha256 校验后落进 `~/.dsh/cache/manim-live/pyodide/`，之后离线命中。取的期间卡片上会提示「正在加载 X…」。想提前存好或清掉，去设置面板的「Manim 渲染」一节，见[设置面板](/guide/settings)。
