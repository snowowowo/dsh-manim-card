# Manim 渲染插件 · README

> 📛 **改名提示**（2026-10-11 追加）：本目录写作时插件叫 `manim-renderer`，Step 5（Phase 1 抽包）之后**仓目录与包名是 `dsh-manim-live`、短功能名是 `manim-live`**（路由前缀 `/dsh-plugins/manim-live/…`、缓存目录 `~/.dsh/cache/manim-live/`）。**正文一律保留当时的名字不改**——它是按时间写的记录（目录树、路径、命令都是当时的事实）。改名清单与执行见容器根 `_docs/工作文档/manim-live/2026-10-10-01-抽出核心包/`。

把旧黑板里的「Python Manim 源码 → 渲染」拆成一个能独立运行的新插件。供跨会话交接。

## 文档

| 文件 | 内容 |
|---|---|
| `顶层设计.md` | 它是什么 / 独立运行判据 / 家底与缺口 / 对外两个面 / 对外服务 / 与黑板的分界线 / 取舍 / 待确认 |

执行步骤（`Step-N-*.md`）等实现开始时再补——本轮只要顶层设计。

## 进度

| 阶段 | 状态 |
|---|---|
| 顶层设计 | 已定稿（2026-10-09；五项决策见 `顶层设计.md` §8） |
| 建包与实现 | 已就位：包骨架 + Python 运行时（`src/core/py/`，Pyodide 真 CPython + 真 numpy，自带测试）+ 渲染引擎 + 聊天卡片 + Host 工具与预检 + 技能 + **对外服务 `manim`**（`check` + `createSurface`） |
| 后续工作 | **支持面 SSOT**（收敛「哪些写法被支持」的定义、让预检与真桥同判；并让表接上 CE 真源）→ 见 `../2026-10-09-02-支持面SSOT/` |

## 事实来源

- 旧实现（冻结参考，不再维护）：`plugins/blackboard.bak/src/{core,engine,host}/`
- 拆解背景与总纪律：仓库根 `AGENTS.md`「当前背景与任务目标」
- 机制 / 安装 / 验证：`.agents/skills/cordis-plugin-development/SKILL.md`
