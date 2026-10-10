# Step 2: 预检与真桥同源

> 一句话：`dry-run-bridge.ts` 不再自己判，改调 `surface.ts` 的 `plan*`；对同一段代码，预检与真桥同判。

## 目标

- 预检的判定逻辑与真桥**共用同一份**（`surface.ts`），消灭「假桥比真桥宽松」。
- 具体消除的漏点：现行 `dry-run-bridge.ts` 的 `create()` 忽略参数、不跑构造规则，所以真桥会拒的写法（如给未登记类传位置参数）预检放行。

## 前置条件

Step 1 完成（`surface.ts` 已存在并被真桥消费）。

## 执行步骤

### 1. 改 `plugins/manim-renderer/src/core/py/dry-run-bridge.ts`

- 删除本地 `assertSupported`（现行 `:13`）与 `assertAnimation`（`:21`）里各自的那套判断。
- `create(kind, args, kwargs)` → 调 `planCreate(kind, args, kwargs)`；抛错即透传。
- `method(_handle, name, args, kwargs)` / `getAttr(_handle, name)` → 调 `planMethod(...)`；抛错即透传。
- `play(_handle, animations)` 里 animate 分支 → 调 `planAnimate(...)`；普通动画逐层调 `planAnimation(...)` 校验 `kind`（组动画递归内部动画，对应现行 `assertAnimation`）。
- 假句柄（`fake()`）逻辑不变——预检仍**不建真对象**。

### 2. 确认 `plan*` 的报错文案与真桥一致

两者现在都从 `surface.ts` 取同一份文案，天然一致；无需在 dry-run 里另写文案。

### 3. 重建产物

```bash
pnpm --filter manim-renderer build
```

（Host 预检走 `core.js`，`src/host/index.js:126` 的 `runPython(python, createDryRunBridge())`，必须重建才生效。）

## 验收

- 新增测试（可并入 `runtime.test.ts` 或另建）：对三类输入断言**预检与真桥同判**——
  1. 表里 `state === 'missing'` 的方法 → 两边都拒；
  2. 未登记类传位置参数（构造规则会拒）→ 两边都拒；
  3. 表里 `state === 'ok'` 的类/动画 → 两边都过。
- `pnpm --filter manim-renderer test` 全绿。
- 真机：提交一段含**构造参数错误**的代码（如给未登记类传位置参数），工具返回 `ok:false` 且 `error` 可读（不再是天书）。
- 回归：提交一段正常 Manim 代码，返回 `ok:true`，卡片能画。

## 完成状态

- 状态：已完成（2026-10-09）
- 备注：预检与真桥都只经 `surface.ts` 的 `plan*` 判定，不再各写一份。新增 `src/core/py/bridge-parity.test.ts`（6 例）锁「同输入同判」：同一段写法在 dry-run 与真桥上要么都放行、要么都拒。
