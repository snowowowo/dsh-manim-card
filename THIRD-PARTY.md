# 第三方组件与许可

本项目依 [MIT](./LICENSE) 授权。下面列出**随本项目一起分发**的第三方组件及其许可——它们不受本项目 MIT 条款约束，各依其自身条款。

清单只收「分发出去的东西」，来源是 `package.json` 的生产依赖与随包资源目录，逐一核对目录里的实际文件——不是从许可证声明里抄的。

## 一、随包分发的运行资源

### Pyodide v0.27.7 —— Mozilla Public License 2.0

浏览器内的 Python 运行时，原样 vendored 在 `assets/pyodide/`，**未改动任何文件**。

| 项 | 位置 |
| --- | --- |
| 许可全文 | [`assets/pyodide/LICENSE`](./assets/pyodide/LICENSE) |
| 告知与源码地址 | [`assets/pyodide/NOTICE.md`](./assets/pyodide/NOTICE.md) |
| 源码 | <https://github.com/pyodide/pyodide> |

MPL-2.0 是**文件级** copyleft：只要不改它的文件，本项目自己的代码可以用自己的条款（本项目用 MIT）。上面两份文件即为对外分发时须随附的告知。

另：不得用 Pyodide 的名字或 logo 暗示官方背书或合作。

### 随包的 Python wheel（BSD-3-Clause）

| 包 | 版本 | 许可 | 许可文件 |
| --- | --- | --- | --- |
| numpy | 2.0.2 | BSD-3-Clause | wheel 内 `numpy-2.0.2.dist-info/LICENSE.txt` |
| sympy | 1.13.3 | BSD-3-Clause | wheel 内 `sympy-1.13.3.dist-info/LICENSE` |
| mpmath | 1.3.0 | BSD-3-Clause | wheel 内 `mpmath-1.3.0.dist-info/LICENSE` |

三个 wheel 都在 `assets/pyodide/`，各自把许可随包带着。

### KaTeX —— MIT

公式排版样式与字体，在 `assets/katex/`（`katex.min.css` 与 `fonts/`）。

| 项 | 位置 |
| --- | --- |
| 许可全文 | [`assets/katex/LICENSE`](./assets/katex/LICENSE) |
| 版权 | Copyright (c) 2013-2020 Khan Academy and other contributors |
| 源码 | <https://github.com/KaTeX/KaTeX> |

## 二、构建产物内联的浏览器侧库

`client.js` 是构建期产物（由 `pnpm build` 生成），下面这些库被**内联**进该文件，随插件一起分发。

| 库 | 版本 | 许可 |
| --- | --- | --- |
| manim-web | 0.39.4 | MIT |
| shiki | 4.5.0 | MIT |
| @shikijs/langs | 4.5.0 | MIT |
| lucide-react | 0.548.0 | ISC |

其中 **manim-web 的浏览器构建本身已经把它的运行时依赖预打包在内**（three.js、KaTeX、MathJax、lottie-web、jspdf、opentype.js 等），因此这些组件也随 `client.js` 一起分发。它们各依其自身许可，许可与版权信息见 manim-web 的发行包及其上游项目——本清单不复述。

## 三、不随包分发

| 项 | 说明 |
| --- | --- |
| react / react-dom | 写在 `peerDependencies`——由宿主提供，**不随包、不进构建产物** |
| 未随包的 Python 库（pandas / scipy / scikit-learn 等） | 运行期按需从 Pyodide 官方发行通道取得，取用方是终端用户，本项目不是分发方；其许可见 Pyodide 的包目录 |
