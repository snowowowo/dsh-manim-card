# 安装

## 前置

- **DeepSeek Harness 桌面版**（插件以宿主的 slot / 服务机制接入，离开宿主没有意义）。
- 浏览器侧要有 **WebGL**（画布用 three.js 渲染）与 **WebAssembly**（Pyodide 跑真 CPython）——宿主桌面版自带的 WebView 满足。
- 基础功能**不要求本机装 Python**：执行发生在浏览器里的 Pyodide。只有两个功能碰本机：
  - **导出 mp4**：要本机装的 `manim` 命令行 + `ffmpeg`（缺什么，设置面板与导出按钮都会明说）；
  - **第三方 Python 库按需取**（`import pandas` 这类）：首次联网取一次，之后离线命中，见下文。

## 安装

任选其一（在宿主的 CLI / 插件管理里执行）：

```bash
# 从 npm（发布后可用）
dsh plugin add dsh-manim-live

# 从 tarball
dsh plugin add ./dsh-manim-live-<版本>.tgz

# 从 GitHub 仓库直装（仓根即包）
dsh plugin add github:snowowowo/dsh-manim-live
```

::: tip 未实测项
npm 发布与 GitHub 直装两条链路尚未走通验证过（仓库当前私有）；当前开发期用 profile 内软链 +
patch 条目的方式安装，HMR 生效。落地时会更新本页。
:::

## 随包资源，不用另配

- **Pyodide 发行版随包**（`assets/pyodide/`）：核心 wasm + 标准库 + numpy / sympy / mpmath——装完插件，断网也能画基本图形。
- **KaTeX 样式与字体随包**（`assets/katex/`）：`MathTex` 公式渲染用。
- 两者都由插件的 Host 路由同源分发，不依赖外网 CDN。

## 哪些东西按需联网

`import pandas` 这类**随包没有的第三方库**：首次用到时联网取一次，按 sha256 校验后落进
`~/.dsh/cache/manim-live/pyodide/`，之后离线命中。取的期间卡片上会提示「正在加载 X…」。
想提前存好或清掉，去设置面板的「Manim 渲染」一节，见[设置面板](/guide/settings)。

## 与核心包的关系

执行 / 渲染的真本事（Pyodide 运行时、manim 适配层、支持面、画布）在独立 npm 包
[manim-live](https://github.com/snowowowo/manim-live)（[文档站](https://snowowowo.github.io/manim-live/)）里；
本插件负责宿主接入与资源分发，并在它之上做了预检、播放调度、实验场与导出。
想脱离宿主、在自己的页面里用画布，直接看核心包的文档。
