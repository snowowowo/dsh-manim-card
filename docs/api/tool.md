# API 参考：宿主工具

本插件向宿主注册一个工具 `manim_render`，由模型调用，把一段 Manim Python 变成聊天流里的动画卡片。它不属于 JavaScript API（本插件不导出可 `import` 的模块），但它是本插件对外的第一条面，入参与返回都是稳定契约，故收在 API 参考里。服务面见[manim-card 服务](/api/service)。

## manim_render

```yaml
name: manim_render
parameters:
  python: string        # 必填
returns:
  ok: boolean
  error?: string
```

**入参**

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `python` | `string` | 是 | Manim Python 源码。完整文件（`from manim import *` 加 `class X(Scene)`）与只写 `construct` 体内语句两种形态都收 |

**返回**

| 字段 | 出现条件 | 含义 |
| --- | --- | --- |
| `ok` | 恒有 | 预检是否通过。`true` 表示代码已写进会话，卡片即将出现在聊天流 |
| `error` | `ok` 为 `false` 时 | 预检失败原文，带行号，可直接给模型自我修正 |

`python` 为空（去掉首尾空白后长度为 0）时直接返回 `{ ok: false, error: 'python 不能为空' }`，不启动运行时。

## 工具做什么、不做什么

工具在返回之前，把代码**在真解释器里干跑一遍**：先解析语法，再在「什么都不画」的桥上执行一遍，拦下语法错误、未定义的名字与 manim-web 实测缺失的能力。只有通过预检的调用才写进会话日志，卡片随之由 Client 侧折叠出来。

这条预检跑在**宿主的 Node 侧**，是一份与本机环境无关的 Python 运行时（核心包 `manim-live/node` 的 `runPython` 与 `createDryRunBridge`）。因此：

- 预检不要求用户装 Python，也不受本机 `manim` 命令行是否存在影响——那是导出才需要的；
- 预检与浏览器里的渲染是**两份运行时**：它证明代码在 Python 层面成立，不等于浏览器里一定画出画面。

工具本身**不产出画面**。渲染发生在浏览器里、由聊天卡片承担；渲染期的错误（真实绘制、布局、WebGL）由卡片回显，不回到工具返回里。因此 `ok: true` 的含义是「代码已受理」而不是「已经画出来了」。

另外，`ok` 与 `error` 是工具返回的全部字段：`check()` 里那份 `warnings` 不经过工具，它只服务界面提示，见[数据类型](/api/types#checkresult)。

## 配套注册的另外两件

工具要能用，除了工具本身还需要两处上下文，都由本插件在加载时一并注册：

**领域技能 `manim-card`**。一份 Markdown（`skills/manim-card/SKILL.md`），讲清 manim_render 的写法边界、可用的 Manim API、manim-web 实测缺失项与替代写法。它整份以内存字符串注册进宿主的 `skills` 服务，模型一次调用即拿到全部，不需要再去读文件；`skills` 服务缺席时打一条 `console.error` 并跳过，工具仍可用，只是模型只能依赖工具描述。

**常驻小指引**。一段安装进系统提示的短文本（`manim-card:guide`），讲「何时调用」与「代码口径」五条：先加载技能再写代码、优先写完整文件、`ok: false` 时按行号改好再调一次、不要用文字复述画面、渲染成功后提醒用户卡片会被折叠。

## 使用者的可见结果

一次成功的 `manim_render` 在聊天流里留下一张卡片，行为（自动播放规则、手动播放、查看代码、导出 mp4）见[在聊天里用](/guide/usage)。同一回合内模型并行调用多次，会产生多张卡片，其中只有最后一张完整播放，见[在聊天里用](/guide/usage#自动播放规则)。
