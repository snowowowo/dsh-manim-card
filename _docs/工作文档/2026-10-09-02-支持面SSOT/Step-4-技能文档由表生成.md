# Step 4: 技能文档由表生成（可延后）

> 一句话：`SKILL.md` 的「可用 API 清单」与「实测缺失项」两段由三态表生成，收掉最后一份手写。

## 目标

- 技能文档里的**清单类内容**（可用 API、animate 白名单、缺失项与替代）由 `api-map.generated.ts` 生成，与表永远同步。
- **手写部分只留**：写法叙述、示例、纪律、报错处理——这些不是「表能表达的东西」。

### 为什么必须做（漂移证据）

当前手写清单已与表**不同步**（本轮实测）：

- 表里 `kind === 'method' && state === 'ok'` 共 **41** 个，`SKILL.md` 的「方法」行只列了 **32** 个——**漏列 9 个**：`get_updaters` `get_start` `get_end` `plot_line_graph` `get_axis_labels` `c2p` `coords_to_point` `get_riemann_rectangles` `input_to_graph_point`。
- animate 白名单：表 20 个 / SKILL 20 个，当前一致——但靠人手对齐，迟早再漂。

漂移方向「漏报」虽不误导模型，但白白挡掉了可用能力；且每次 manim-web 升级重跑探针后，清单不会自动跟上。

## 前置条件

Step 3 完成（SSOT 与判定已被一致性测试锁定）。

## 执行步骤

### 1. 在 `skills/manim-renderer/SKILL.md` 的生成段加标记块

只包裹**清单类**内容，其余保持手写：

```
<!-- gen:api-list -->
（这段由 scripts/gen-skill.mjs 生成）
<!-- /gen:api-list -->

<!-- gen:missing -->
（这段由 scripts/gen-skill.mjs 生成）
<!-- /gen:missing -->
```

### 2. 写 `plugins/manim-renderer/scripts/gen-skill.mjs`

- 读 `src/core/py/api-map.generated.ts`（与 `scripts/probe-api.mjs` 同为脚本，不依赖构建）。
- 按 `kind` + `state` 分组产出文本：
  - **api-list**：`ok` / `alias` 的 `class` / `anim` / `method` / `const` / `color` / `rate` 分组清单；
  - **missing**：`state === 'missing'` 项 + `alt` 替代，排成「不支持 → 改成」表。
- 用生成文本替换两处标记块之间的内容（幂等：重复跑结果一致）。

### 3. 跑法与同步

```bash
node scripts/gen-skill.mjs
```

- 约定：**改表 / 重跑探针后，紧接着跑本脚本**。
- **不需要**重建 `client.js` / `core.js`——`SKILL.md` 由 Host 在运行时读盘注册（`src/host/index.js:143` 读盘、`:148` 注册），不参与构建。

## 验收

- 跑脚本 → `SKILL.md` 两段与 `PY_API_MAP` 一致（「方法」行应含全部 41 个 ok 方法）。
- 人工核对一段：挑 3 个清单项，确认表中状态与文档描述一致。
- 反向自检：临时改表中一项为 `missing` → 重跑脚本 → 该名字从 api-list 移到 missing 段；改回。

## 完成状态

- 状态：已完成（2026-10-09）
- 备注：
  - 新增 `scripts/gen-skill.mjs`；`SKILL.md` 里的清单段改为 `<!-- gen:api-list -->` / `<!-- gen:missing -->` 标记块，由表生成（约定：**改表 / 重跑探针后紧接着跑本脚本**）。
  - 顺带修掉手写段落里几处「指错路」的替代文案：`set_z_index()`、`getPartCount()` 在 manim-web 里**都不存在**；`restore()` 现已支持（映射到 `restoreState`）；`exponential_slope` 不是 CE 名（应为 `exponential_decay`）。
