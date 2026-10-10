# Step 1: 抽出支持面模块（数据 + 判定），真桥改为消费它

> 一句话：新建 `src/core/py/surface.ts` 承载「支持面」的数据与判定；`manim-bridge.ts` 改为调它，行为保持不变。

## 目标

- `surface.ts` 成为**支持面的唯一定义处**：数据（三态表出口 + 构造规则）+ 判定（`plan*` 纯函数）。
- `manim-bridge.ts` 不再自持 `CTOR` / `ctorArgs`，改为调 `surface.ts`。
- **行为不变**（现有 36 条测试全绿即证明）。

## 前置条件

无。（本 Step 只做「搬家 + 收口」，不改任何对外行为。）

## 执行步骤

### 1. 新建 `plugins/manim-renderer/src/core/py/surface.ts`

内容三块：

1. **数据出口**：重导出探针产物，作为唯一入口。
   ```ts
   export { PY_API_MAP, PY_COLOR_HEX, PY_ANIMATE_METHODS } from './api-map.generated.ts'
   ```
2. **构造规则**：把 `manim-bridge.ts:47` 的 `CTOR`（`CtorSpec` 与各类型的 `mode` / `keys`）与 `manim-bridge.ts:105` 的 `ctorArgs` 逻辑整体迁入本模块。
3. **判定（纯函数）**：
   ```ts
   export function planCreate(kind: string, args: unknown[], kwargs: Record<string, unknown>): unknown[]
   export function planAnimation(kind: string, targets: unknown[], kwargs: Record<string, unknown>): unknown[]
   export function planMethod(name: string, args: unknown[], kwargs: Record<string, unknown>): { jsName: string; args: unknown[] }
   export function planAnimate(calls: { name: string; args: unknown[]; kwargs: Record<string, unknown> }[]): typeof calls
   ```
   - 口径（对照 `设计-支持面SSOT.md` §4.3）：
     - `state === 'missing'` → 抛可读错（附 `alt` 替代文案）；
     - `state === 'ok' / 'alias'` → 放行，给出 js 名 / 构造参数；
     - 表外名字 → 放行（口径见设计 §5.1）。
   - `planCreate` 用**迁入的构造规则表**决定物体参数形状；`planAnimation` 只管动画（与 `manim-bridge.ts:199` 的 `build()` 对应），两条路径不混。
   - **不碰句柄解析**：`resolve()` / 对象登记仍属真桥，`plan*` 只返回「放行的形状」。

### 2. 改 `plugins/manim-renderer/src/core/py/manim-bridge.ts`

- 删本地的 `CTOR`、`ctorArgs`、以及仅供其使用的 `CtorSpec` 类型。
- `create()` / `method()` / `play()` 在构造/调用前改调 `surface.ts` 的 `planCreate` / `planMethod` / `planAnimation` / `planAnimate`，拿到放行的参数后**照原逻辑执行**（句柄解析、`new Ctor(...)`、apply 等原地保留）。
- 保留本地可读报错（如 `未知的对象句柄`、`play 只能用于场景`）——那些是**执行期**错误，不属于支持面判定。

### 3. 改 `plugins/manim-renderer/src/core/index.ts`

- 补导出 `surface.ts` 的类型与函数（供预检与测试消费）：
  ```ts
  export { planCreate, planAnimation, planMethod, planAnimate, PY_API_MAP } from './py/surface.ts'
  ```

### 4. 重建产物

产物随包提交，必须重建（Host 侧 `src/host/index.js:13` 直接 import `../../core.js`）：

```bash
pnpm --filter manim-renderer build
```

## 验收

- `pnpm --filter manim-renderer test` 全绿（现有 36 条，一条不改、一条不红）。
- `./node_modules/.bin/tsc -p tsconfig.json`（在 `plugins/manim-renderer/` 下）通过。
- 产物核对：`grep -c "_AnimateChain" core.js client.js` 与改前一致；`core.js` / `client.js` 时间戳更新。
- 真机：刷新页面后在聊天里调一次 `manim_render`，卡片能画（行为未变）。

## 完成状态

- 状态：已完成（2026-10-09）
- 备注：
  - 新建 `src/core/py/surface.ts`：三态表再导出 + 判定纯函数 `planCreate` / `planAnimation` / `planAnimate` / `planMethod`，并承接从 `manim-bridge.ts` 搬来的 `CTOR` 构造规则表。
  - `manim-bridge.ts` 删掉本地 `CTOR` / `camel` / `camelKeys`，`dry-run-bridge.ts` 删掉本地 `assertSupported` / `assertAnimation`，两侧一律改调 `plan*`。
  - `src/core/index.ts` 增补导出（`plan*` / `camel` / `camelKeys` / `PY_API_MAP` / `PY_COLOR_HEX` / `PY_ANIMATE_METHODS` / `PyApiEntry`）。
