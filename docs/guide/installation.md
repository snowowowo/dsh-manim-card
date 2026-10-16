# 安装

## 前置条件

DeepSeek Harness 桌面版。运行资源（Python 运行时与公式字体）随插件分发，本机不需要安装 Python 或其它依赖。

## 安装

在宿主的插件管理里任选一条命令：

| 方式 | 命令 |
| --- | --- |
| 从 tarball | `dsh plugin add ./dsh-manim-card-<版本>.tgz` |
| 从 GitHub 仓库 | `dsh plugin add github:snowowowo/dsh-manim-card` |

装完刷新宿主页面，设置里出现「Manim卡片」一节。

## 联网

首次渲染需要把运行资源取进浏览器（约 13 MB），之后离线可用。代码用到随包之外的三方库（例如 `import pandas`）时，首次需要联网取一次，取到后缓存在本机。

## 卸载

按宿主的插件管理卸载。缓存目录 `~/.dsh/cache/manim-live/pyodide/` 在插件目录之外，卸载不会删除它；要回收空间就手动删掉这个目录。
