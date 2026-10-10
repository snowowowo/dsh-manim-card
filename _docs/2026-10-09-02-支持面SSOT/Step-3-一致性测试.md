# Step 3: 一致性测试（表 ↔ 判定）

> 一句话：加一条遍历三态表的测试，锁死「表」与「判定」的对应关系，防止未来漂移。

## 目标

- 让 SSOT 的**数据**与**判定**在任何改动后都被自动校验：表里说什么，`plan*` 就必须照做。
- 覆盖：`class` / `anim` / `method`（含 `scene-method`）/ `alias` 项。

## 前置条件

Step 2 完成（`surface.ts` 已被真桥与预检共同消费）。

## 执行步骤

### 1. 新建 `plugins/manim-renderer/src/core/py/surface.test.ts`

遍历 `PY_API_MAP`，按 `state` 与 `kind` 断言：

| 表里 | 断言 |
|---|---|
| `kind === 'class'` 且 `state === 'ok'` | `planCreate(name, [], {})` 不抛 |
| `kind === 'class'` 且 `state === 'missing'` | `planCreate(name, [], {})` 抛 |
| `kind === 'anim'` 且 `state === 'ok'` | `planAnimation(name, [], {})` 不抛 |
| `kind === 'anim'` 且 `state === 'missing'` | `planAnimation(name, [], {})` 抛 |
| `kind ∈ {method, scene-method}` 且 `state === 'ok'` | `planMethod(name, [], {})` 不抛，返回的 `jsName` 为 camelCase |
| `kind ∈ {method, scene-method}` 且 `state === 'missing'` | `planMethod(name, [], {})` 抛 |
| `kind ∈ {method, scene-method}` 且 `state === 'alias'` | `planMethod(name, [], {})` 返回带映射的 js 名 |
| animate 白名单外的方法（如 `set_value`） | `planAnimate([{ name: 'set_value', args: [], kwargs: {} }])` 抛 |

`kind` 为 `const` / `color` / `rate` 的项**不在本测试范围**：它们不经 `plan*` 判定，由适配层的别名生成消费（见设计 §4.4）。

### 2. 红线（**必须遵守**）

- **禁止文案断言**：只断言「抛 / 不抛」与返回结构（`jsName` 是否存在、args 是否数组），**不断言错误消息文字**——否则改措辞就红。
- **禁止结构 / 计数镜像断言**：不写「表里有 N 项 ok 就断言 N」这类。
- 用例与被测文件同目录、命名 `*.test.ts`。

### 3. 反向自检（验证测试真的有效）

临时把 `api-map.generated.ts` 里任一 `state === 'ok'` 的类改成 `'missing'`，确认测试**变红**；改回，确认**变绿**。

## 验收

- `pnpm --filter manim-renderer test` 全绿。
- 反向自检通过（见执行步骤第 3 条）。
- 不新增对 `client.js` / `core.js` 的要求（本 Step 只加测试，**无需重建产物**）。

## 完成状态

- 状态：已完成（2026-10-09）
- 备注：新增 `src/core/py/surface.test.ts`（9 例）：对**全表**逐项断言 ok 放行 / missing 拒 / alias 映射，只断言「抛没抛」与返回结构（不写文案、不写条数快照）。反向自检：把表里 `Circle` 手工改成 `missing` → 测试变红；改回 → 变绿。
