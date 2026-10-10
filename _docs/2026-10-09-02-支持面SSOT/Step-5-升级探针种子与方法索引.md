# Step 5: 升级探针（种子改由 CE 包枚举 + 全量方法索引）

> 一句话：把探针的「域」从手写种子换成 Manim CE 公开 API 枚举、运行环境从 Node 直跑换成无头浏览器，方法探测从 6 个手搭实例扩到全部可构造实例，产出更完整的 `api-map.generated.ts`。

## 目标

- **种子来源**：`scripts/official-api-seed.json`（手写，约 250 名，自注 "curated 不求全"）→ 由 **CE 包公开名**枚举生成（域侧自动；CE 作构建期依赖，见设计 §6.1 决策 2）。
- **运行环境**：Node 直跑（现状，见 `scripts/probe-api.mjs:3`）→ **无头浏览器**内实测（设计 §6.1 决策 1）。
- **方法覆盖**：现在只在 6 个手搭实例上测（`circle` / `line` / `axes` / `mathtex` / `vgroup` / `tracker`）→ 给**每个可构造实例**建方法索引（Node 基线：247/485 可无参构造，换环境后应上移）。
- **表结构**：`method` 项的命中类维度（现有 `targets` 字段）扩到全量，使预检也能判「某类上没有某个方法」，收掉设计 §5.2 的诚实边界。
- **验收标准**：新表项与 `missing` 项明显增加；现有 36 条测试 + `Step-3` 一致性测试全绿。

## 前置条件

- `Step-1`（`surface.ts` 已建并被真桥消费）与 `Step-3`（一致性测试）完成——**表变大之前，锁定测试必须先就位**，否则扩表引入的判定漂移无法被拦。
- 环境就绪（构建期依赖，不进插件产物）：隔离 Python 环境装好 CE（步骤 1）、`playwright` 装好并 `playwright install chromium`（步骤 2）。

## 执行步骤

### 1. 取 CE 公开名，生成域清单

- **建隔离环境**：把 `manim` 钉死版本记入 `scripts/probe-requirements.txt`，装进独立虚拟环境（不污染系统 Python；工具与版本号第一次跑时定下，见设计 §6.2）。
- **CE 不只是 `pip install`**：官方要求系统级依赖——macOS `brew install py3cairo ffmpeg`（Apple Silicon 另加 `pango pkg-config scipy`）、Linux `libcairo2-dev libpango1.0-dev ffmpeg`。LaTeX **不必装**：本步只用 `import manim` 枚举名字，不渲染。
- 新增 `scripts/export-ce-api.py`：`import manim` 后取公开名（`__all__` 优先，缺则 `dir(manim)` 滤掉 `_` 前缀），按现有 seed 结构分组（`classes` / `animations` / `functions` / `constants` / `mobjectMethods`）写出 `scripts/ce-public-api.json`。
- ⚠️ **这个分组只是「要测哪些名字」的清单，不是「它是什么」的结论**：CE 把 `TracedPath` / `AnimatedBoundary` 放在 `manim/animation/changing.py` 里，两者其实 `extends VMobject`。物体/动画的归类由探针在浏览器里**实测原型链**决定（见下 §2），按分组归会出错。
- **钉死的 CE 版本号写进生成物注释**（与 `api-map.generated.ts` 的产物头同例），使「这份表来自哪版 CE」可追溯。
- CE 包的公开名是**有限、可枚举**的——这是把「无界差集」换回「有界清单」的关键（设计 §4.5）。
- **保留**手写的 `KNOWN_MISSING` 与 `KNOWN_ALIAS`（人工残留的两处，见设计 §4.5），它们不作自动生成。

### 2. 探针改为无头浏览器内实测（`scripts/probe-api.mjs`）

- **依赖**：`playwright`（+ `@playwright/test`）作为**仓库根** `devDependencies`——与 `vitest` 同例，全仓一份，插件不各自声明（本仓现状：无任何浏览器自动化依赖，需新引）。
- **harness**：新增最小页面（如 `scripts/probe/harness.html`），只做一件事——以 ESM 载入 `manim-web`、把命名空间挂到 `window`，供页面上下文取用。
- **入口不变**：仍是 `node scripts/probe-api.mjs`；脚本内部改为 `chromium.launch()` → `page.goto(harness)` → `page.evaluate()` 里跑现有的三件事（存在性 / 构造 / 方法索引），结果回传 Node 落盘。
- **构造**：把 `probeTargets`（现手搭 6 个，`scripts/probe-api.mjs:19`）改为遍历全部导出类 → 逐个尝试构造 → 对成功的实例建「类 → 方法集」索引。带真 canvas 后，Node 基线里失败的应能构造出一部分——**先只做能自动的**，其余留空并记录，不强行人工补全。
- **方法枚举必须走 `Object.getOwnPropertyDescriptor` 并跳过存取器（`descriptor.get`）**——getter 的副作用不止音频（懒加载 / 埋点），且读它本就不该是探针的行为（Node 基线：共跳过 1401 个存取器）。
- `hasFn` 改为查索引；`animate` 白名单仍从 animate 代理原型实读（现逻辑不变）。

### 3. 重跑探针、重建产物

```bash
python scripts/export-ce-api.py        # 域清单（隔离 Python 环境，装好 CE）
node scripts/probe-api.mjs             # 无头浏览器内实测 → api-map.generated.ts
pnpm --filter manim-renderer build
```

（产物随包提交；Host 预检走 `core.js`。）

### 4. 同步技能文档

若 `Step-4` 的 `scripts/gen-skill.mjs` 已落地，紧接着跑它，让 `SKILL.md` 清单跟上新表。

## 验收

- `node scripts/probe-api.mjs` 输出的**项数与 `missing` 数均大于改前**（Node 基线 247 项：ok 222 / alias 8 / missing 17）。
- **换环境后 ② 层重测**：无参构造成功数应高于 Node 基线（261/485），剩余失败项被记录而非强行补全。
- `pnpm --filter manim-renderer test` 全绿；`Step-3` 一致性测试对**新表**仍全绿（表里 ok/alias 必能落、missing 必能拦）。
- `./node_modules/.bin/tsc -p tsconfig.json`（在 `plugins/manim-renderer/` 下）通过。
- 抽查 3 个「改前未收录、现已收录」的 CE 名：真机提交对应代码，预检与真桥**同判**。
- 反向自检：手工把新表里任一 `ok` 项改成 `missing`，一致性测试应**变红**；改回变绿。

## 待确认问题

- ✅ **运行环境**：已定无头浏览器（Playwright），见设计 §6.1 决策 1。
- ✅ **CE 依赖**：已定 CE 作构建期依赖（隔离环境 + 钉版本），见设计 §6.1 决策 2。
- ❓ 落地细节（Playwright 版本、CE 版本号、Python 环境工具）随第一次跑定下，写进生成物注释。

（第 1–2 步即环境搭建：先备好隔离 Python 环境与 Playwright，再改探针实现；落地细节随第一次跑定下，两项已定不再回问。）

## 完成状态

- 状态：已完成（2026-10-09）
- 备注：
  - **环境**：Playwright 1.64 + **完整 Chromium**（`chromium.launch({ channel: 'chromium' })`）；不依赖另下载的 `chrome-headless-shell`（本次它下载卡住，改走完整浏览器，也更接近卡片真实运行环境）。Manim CE **0.22.0** 装在隔离环境 `.venv-probe/`（已进 `.gitignore`，`brew install pkg-config cairo` 后才装得上 pycairo）。
  - **域清单**：`scripts/export-ce-api.py` 枚举 CE → `scripts/ce-public-api.json`，共 **429** 个名字（160 类 / 76 动画 / 9 函数 / 89 色 / 17 速率 / 17 常量 / 61 方法）。
  - **探针**：`scripts/probe-api.mjs` 改为无头浏览器内实测。入口用 manim-web **官方浏览器构建** `dist/manim-web.browser.js`——`dist/index.js` 带 `three` / `@mathjax/src` / `opentype.js` 等裸模块名，浏览器原生 import 解析不了（要靠打包器）；两者同版本、同一份 `dist/index.d.ts`。
  - **表**：429 项 → **ok 365 / alias 2 / missing 62**（Node 基线 247 项：ok 222 / alias 8 / missing 17）——项数与 missing 数均大于改前 ✅
    - ⚠️ **后续重跑已修正为 ok 374 / missing 53**（同批接线 `rate_func` 时把速率的探测从「名字在不在」换成**按行为实测**：导出的可能是柯里化工厂，直接当速率用会拿到函数）。这 9 个由 missing 翻 ok 的全是速率：`double_smooth` `exponential_decay` `not_quite_there` `running_start` `rush_from` `rush_into` `slow_into` `there_and_back` `there_and_back_with_pause`——**旧口径把它们误判成缺失，技能文档据此让模型绕开了一批本来能用的速率**。
  - **`alias` 口径收窄**：原来 `set_opacity`（→ `set_fill_opacity` + `set_stroke_opacity`）、`put_start_and_end` 记成 `alias`，而 alias 在判定里是**放行**——预检放过、真桥走到不存在的 `setOpacity` 才炸。描述串没法自动改写，故一律改记 `missing`（预检当场拒 + alt 给改法）；`alias` 只留给适配层能翻译的写法（`animate` 链、`m[i]`）。
  - **同判实测**：拿**构建产物** `core.js` 的 `planMethod` 对 14 个名字（含改前误判的 `to_edge`/`to_corner`/`become`/`stretch`/`flip`/`interpolate`、改名项 `restore`、以及被拒的 `set_opacity`/`set_z_index`/`put_start_and_end`/`surround`/`bring_to_front`）与**真 manim-web 实例**对测，**不一致 0 条**：放行的真机都有该方法，被拒的真机都没有。
  - **②③ 层数字**：无参构造存活 **255 / 588**（排除 `AnimateProxy` / `CameraAnimateProxy`）；方法索引去重 **769**；跳过存取器 1404。
  - **换环境后纠正了 Node 基线的大片误判**：`become` / `to_edge` / `to_corner` / `stretch` / `flip` / `interpolate` / `MovingCameraScene` / `ThreeDScene` / `PolarPlane` / `TracedPath` 等在 Node 基线里是 missing，实测**都支持**。旧的 missing 清单会让预检拒掉完全合法的 Manim 代码。
  - **探针自身修了三处**：① 方法索引**排除 `*Proxy`**——否则只存在于 `AnimateProxy` 上的方法（`setOpacity`）会被记成普通物体也支持；② `PY_COLOR_HEX` **不再写入 null**（CE 色板比 manim-web 大，null 会让适配层生成 `NAME = null`，整个 shim `NameError`）；③ 方法索引与判定改用**无原型对象 / 只认自有键**（`toString` 这类会从 `Object.prototype` 读出来）。
  - **人工残留**：`KNOWN_RENAME` 加 `restore → restoreState`（实测 `saveState`/`restoreState` 成套存在）；`KNOWN_MISSING` 的替代文案逐条核过，引用的方法名都真实存在。
  - **种子漂移门禁**：`export-ce-api.py` 新增 `phantom_methods()`——人工方法清单里对不上 CE 的名字会告警并记进 `_phantomMethods`。首次跑出 2 个：`get_parts`、`put_start_and_end`（CE 0.22 都没有；两个都保留作方言兼容，`get_parts` 实测命中 `MathTexPart` 故记 `ok`，`put_start_and_end` 无对应记 `missing`，alt 给改法）。
  - **消费方补齐**：适配层补 `OUT` / `IN` / `X_AXIS` / `Y_AXIS` / `Z_AXIS`（表里 ok 或适配层自带，此前 Python 侧是 `NameError`）。
  - **验收**：`pnpm --filter manim-renderer test` 51/51 全绿；`tsc --noEmit` 通过；一致性测试对**新表**仍全绿；反向自检（`Circle` → missing）变红、改回变绿 ✅（后续接线 rate_func 等四项并补回归后重验：**68/68 全绿**）
- 遗留（另开一轮，不在本 Step 范围）：
  - ~~`rate_func=` 未接线~~ —— **已解决（2026-10-09）**：速率名由表生成成字符串标记过桥，判定 `planRate` 查表翻成 manim-web 的 `rateFunc`（柯里化工厂先无参调一次）；同批还补了 `m[i]`、`m.width` 一类属性读取、`self.clear()` 三处同类缺口，以及动画改走同名工厂函数、位置参数改带 `__handle` / `__animations` 标记两处执行期形状修正。见 `README.md`「结果与遗留」。
