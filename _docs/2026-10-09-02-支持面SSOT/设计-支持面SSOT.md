# 支持面 SSOT · 设计

> 本文只写目标、方案、取舍与决策；文件级执行步骤见同目录 `Step-N-*.md`。

## 问题处理清单

### 第 1 轮（2026-10-09，检查/修复）

| # | 严重度 | 问题 | 处理结果 |
|---|--------|------|----------|
| 1 | 严重 | 全篇只写「表由探针生成」，未写**种子从哪来、实测到哪一层**——「补不完」的根因与生成侧方案未入档 | ✅ 已修正：新增 §4.5「来源与生成」 |
| 2 | 重要 | §3 引用「上图」，文档内并无该图（悬空引用） | ✅ 已修正：改为指向 §1 表 |
| 3 | 重要 | §5.2 / §6 把「升级探针」列为待确认，与本轮结论（应做）冲突 | ✅ 已修正：转为 `Step-5`；§6 两项环境/依赖待确认已于第 2 轮定案（见 §6.1） |
| 4 | 重要 | §5.1「表外放行」未说明种子换成 CE 枚举后「表外」集合会收窄，口径含糊 | ✅ 已修正：补一句边界说明 |
| 5 | 重要 | `Step-3` 断言表漏 `method · ok`，且未说明 `const`/`color`/`rate` 为何不在范围 | ✅ 已修正：补行 + 注明原因 |
| 6 | 轻微 | `Step-4` 行号 `:143` 只标读盘、未标注册 | ✅ 已修正：改为「:143 读盘、:148 注册」 |
| 7 | 重要 | `README` 未列生成侧（探针脚本）与 `Step-5`，事实来源缺脚本 | ✅ 已修正：已补 |
| 8 | ❓ | 探针运行环境：Node 直跑（现状）还是挂 jsdom / 无头浏览器？ | ✅ 已定：无头浏览器（用户拍板，见 §6.1） |

### 第 2 轮（2026-10-09，用户拍板决策落地）

| 事项 | 定案 | 落点 |
|---|---|---|
| 探针运行环境 | **无头浏览器**（Playwright） | §6.1 决策 1、`Step-5` 步骤 2 |
| CE 词表取法 | **CE 作构建期依赖**（隔离环境 + 钉版本） | §6.1 决策 2、`Step-5` 步骤 1 |

## 1. 问题

链路是通的，错来自**词表不统一**。

这条链不是「Python 调 JS」的管道，而是**把 Manim CE 翻译成 manim-web 的翻译器**：AI 凭 Manim CE（Python 官方版）的知识写代码 → Pyodide 真跑 → 适配层把 CE 调用翻译成 `spec`（一包 JSON 动作）→ 桥落到 manim-web 真对象。数据通道（`spec`）一直通，图能画；**没通的是「哪些写法被支持」这一份定义的单一性。**

现状是**四处各存一份「真理」**：

| 消费方 | 现在从哪取 | 问题 |
|---|---|---|
| 适配层 `manim-shim.ts` | `PY_API_MAP` 生成别名（`objectAliases` / `colorAliases`） | ✅ 已从表 |
| 预检 `dry-run-bridge.ts` | **自己重写判定**：`assertSupported` 只查 `state === 'missing'`，`create` 忽略参数 | ❌ 分立的一份，且更宽松 |
| 真桥 `manim-bridge.ts` | 名字来自表，但**构造规则 `CTOR`（`manim-bridge.ts:47`）与 `ctorArgs`（`:105`）是手写的另一份** | ❌ 一半分立 |
| 技能文档 `SKILL.md` | 手写散文 | ❌ 分立的一份（实测已漂：表里 41 个 `method·ok`，只列 32 个） |

后果（真实轨迹，`session-24774717`）：`x0.animate.set_value(...)` 报 `'function' object has no attribute`、裸 `Mobject()` 报缺参数——都是「某个消费方缺一份、或口径与别处不同」的表现。补一处，另三处不知道，接着又漂开，所以**补不完**。

## 2. 目标

建立**支持面 SSOT**：把「哪些写法被支持」的**数据**与**判定**定义在一处，四个消费方都从它取，谁也不自己再存一份。

判据：

1. 改一处，四处同步生效；
2. **预检与真桥对同一段代码同判**（都过 / 都拒，报错一致）；
3. 换 manim-web 版本 → 重跑探针即换血，上层四处不动。

## 3. 现状地图（谁从哪取）

见 §1 表。目标态：这四个消费方全部收敛到 SSOT（`surface.ts` 及其数据出口）。

## 4. 设计

### 4.1 SSOT 的边界

- **进**：名字级支持表（三态）、构造参数规则、animate 白名单、改名映射、报错替代文案、**属性读取表（哪些属性可读、走方法还是存取器）、下标取法（`m[i]` 依次试哪几个 getter）**。
- **不进**：渲染执行、句柄登记、Pyodide 装载、卡片 UI。

### 4.2 数据层

| 数据 | 位置 | 来源 |
|---|---|---|
| 名字级三态（class/anim/method/const/color/rate）+ 色值 + animate 白名单 + 动画调法（`call`）/ 速率是否柯里化（`curried`） | `api-map.generated.ts` | 探针 `scripts/probe-api.mjs` 实测生成（已有；来源与分层见 §4.5） |
| **物体还是动画（`kind`）** | 同上 | 探针在无头浏览器里**沿原型链实测**（`Mobject` / `Animation` 谁在链上）——**不信 CE 域清单的模块分组**：CE 把 `TracedPath` / `AnimatedBoundary` 放在 `animation/` 下，两者其实 `extends VMobject`，按分组归成动画会让 `self.add(traced)` 报「未知的对象句柄」。门禁见 `api-map.test.ts` |
| 构造参数规则（位置参数 → 选项键；模式 `options`（可带 `rename` 换 CE 关键字名）/ `leading` / `variadic` / `pack` / `input`（AngleInput 打成首参对象）） | 手写在 `surface.ts` 的 `CTOR`（键名逐一核对 dist/*.d.ts） | **迁入 SSOT**（唯一一份；属人工残留，见 §4.5） |
| 属性读取表（`PROP_READS`）/ 下标取法（`INDEX_GETTERS`） | `surface.ts` | 人工（有界）——探针能测「方法在不在」，测不出「CE 的哪个属性写法对应哪个取法」 |
| **方法改写表**（`METHOD_REWRITES`：CE 方法 → manim-web 的**调用候选组**） | `surface.ts` | 人工（有界）——同上的道理：探针测得出「manim-web 有没有 `setStroke`」，测不出「CE 的 `set_stroke` 该落到 `setStyle` 上」。表里这三个名字记 `alias`（探针的 `REWRITTEN_METHODS` 与之一一对应） |

### 4.3 判定层（纯函数）

新模块 `src/core/py/surface.ts`，无 DOM、无宿主依赖，导出判定函数：

- `planCreate(kind, args, kwargs)` → 物体构造参数（按构造规则表），或抛可读错；
- `planAnimation(kind, targets, kwargs)` → 动画（查表 + 递归校验组动画里的嵌套动画），给出「调工厂还是 `new`」与已 camelCase 的选项，或抛可读错；
- `planAnimationOptions(kwargs)` → 逐动画的选项（`run_time` → `duration`、`rate_func` → `rateFunc` 的解析结果）；
- `planPlayOptions(kwargs)` → `scene.play` 级选项（时长覆盖 + 速率）；
- `planRate(value)`（内部）→ 速率名 → manim-web 导出名 + 是否柯里化工厂；
- `planMethod(name, args, kwargs)` → `{ variants }`：**调用候选组**（每组 = 一次或多次 manim-web 调用）。改写表命中就用它（`set_stroke` → `setStyle({...})`；`put_start_and_end_on` → `putStartAndEndOn(s,e)` 或 `setStart(s)` + `setEnd(e)`，桥挑接收者真有的那组）；否则查表给 camel 名 + 参数，或抛可读错；
- `planAnimate(calls)` → animate 链调用，或抛可读错；
- `planAttrRead(name)` → 属性读取（`getWidth()` 还是 `color`），未登记即抛；
- 数据出口：`PROP_READS` / `INDEX_GETTERS`（适配层据此生成 Python 侧的 `@property` 与 `__getitem__`）。

`planAnimation` 递归校验组动画的嵌套项——外层 `AnimationGroup` 是 ok 不代表里面那个 missing 的动画能放过。

三态 → 判定口径：

| 表里 `state` | 判定 |
|---|---|
| `ok` | 放行，给出 js 名 / 构造参数 |
| `alias` | 放行——**限适配层能翻译的写法**（`animate` 链、`m[i]`） |
| `missing` | 拒绝，抛可读错（附 `alt` 替代文案） |
| 表外（未收录） | **放行**（口径见 §5.1） |

### 4.4 五个消费方

| 消费方 | 从 SSOT 取 | 自己只做 |
|---|---|---|
| 适配层 `manim-shim.ts` | 名字 → 别名生成（`PY_API_MAP` / 色值 / 速率名）+ 属性与下标段（`PROP_READS` / `INDEX_GETTERS`）+ animate 改写（`ANIMATE_REWRITES`） | 生成 Python 源码 |
| 预检 `dry-run-bridge.ts` | `plan*` 判定（**不再自己写**） | 跑判定，不建真对象 |
| 真桥 `manim-bridge.ts` | `plan*` 判定 | 句柄解析 + 执行到 manim-web（animate 链先试代理、再退到物体本身） |
| 技能文档 `SKILL.md` | 清单 / 不支持项 / 替代（生成） | 只补写法叙述 |
| **语料**（实验场页面 `page.tsx` + 回归测试 `examples.test.ts`） | **整套判定跑真管线**：页面逐条肉眼验、测试逐条断言 | 只提供「标准 CE 写法」的样本；不含实现 |

### 4.4.1 语料为什么是消费方（而不是又一份测试）

模型会写的 CE 写法是**开放集合**：靠聊天里撞错再补，等于拿报错当采样器——补完就散、只能在真实会话里复现。
把每条碰到的写法固化成 `src/core/py/examples.ts` 里的一行，同一份语料就同时喂两个出口：

- **页面**（实验场）——人看单条，失败带完整报错；
- **测试**（`examples.test.ts`）——全量跑真管线，一条失败一条红。

`expect: 'reject'` 的条目同样是契约：拒可以，但必须**当场**拒（预检而非真桥）且报错可读。
这条通道上线第一轮就抓出四个真问题（`Angle` 三点多包了一层数组、`MathTex` 变长位置参数、
`ValueTracker` 的 `animate.set_value` 在 manim-web 是独立方法 `animateTo`），全部由改表修掉——
**语料是「人工残留还有多少没接上」的计量器，也是它的验收工具。**

### 4.5 来源与生成（生成侧）

SSOT 不是又一份手写真理——它由**三个来源**合成，其中两个可自动枚举：

| 来源 | 是什么 | 取法 | 自动化 |
|---|---|---|---|
| **域** | 模型会写的词 = Manim CE 公开 API | 枚举 `manim` 包公开名（`from manim import *`）；CE 作**构建期依赖**（§6.1） | 自动 |
| **值域** | 画面能画的东西 = manim-web 能力 | 真机 `import manim-web` 实测（588 项） | 自动 |
| **映射** | ok / alias / missing | 探针逐项对测 | 大部分自动 |
| **人工残留** | ①同动作改名（`restore → restoreState`）②构造参数形状 | 手写 | 人工（有界） |

**关键判据**：SSOT 的**定义域是 CE 的词，不是 manim-web 的词**。故「只从 manim-web 源码生成」只能得到**值域**、得不到**映射**——manim-web 里根本没有 `coords_to_point` 这个名字。人工残留之所以小，是因为只有「两边不一样」的地方才要人写，同名同形占大多数。

> 实测修正（2026-10-09）：原以为有 ≈8 条「语义别名」（如 `coords_to_point → c2p`），实测发现 manim-web 0.3.24 **自己就带 camel 名**（`coordsToPoint` / `putStartAndEndOn` / `setStyle`…），靠 snake→camel 就能落。真正要人写的只剩「改名推不出来」的极少数（当前 1 条：`restore → restoreState`），加构造参数形状。
>
> `alias` 的口径也据此收窄成**一种含义**：只有适配层能翻译的写法才记 `alias`（`animate` 链、`m[i]`）——那样「放行」才是真的。
>
> 原先 `set_opacity`（→ `set_fill_opacity` + `set_stroke_opacity`）、`put_start_and_end` 这类「要改写、但描述串没法自动改写」的条目记成 `alias`，结果**预检放过、真桥走到不存在的 `setOpacity` 才炸**（晚报错、还不知道怎么改）。现已一律改记 `missing`，由预检当场拒 + `alt` 给改法。改完当前表：ok 365 / **alias 2** / missing 62。

**真机实测的分层与自动化边界**（探针 `scripts/probe-api.mjs`；下表为 **无头 Chromium 实测**＝已落地的环境，Node 直跑基线数字见括号）：

| 层 | 做什么 | 实测（无头 Chromium） | 自动化 |
|---|---|---|---|
| ① 存在性 | 名字 `!== undefined` | manim-web 导出 588 个；域内 429 名逐项查 | 全自动 |
| ② 造实例 | 无参 `new`（方法探测的前提） | 255 / 588（Node 261/485）——**排除 `*Proxy` 2 个** | 半自动（缺口需构造配方） |
| ③ 方法索引 | 遍历实例原型取方法 | 255 实例 → 769 方法名（Node 247 → 775） | 自动 |
| ④ 语义同义 | 同名是否同形 / 同义 | — | 人工抽样 |

实测三条卡点（都是踩过才写下的约束）：

- **getter 有副作用**：直读实例属性会触发。Node 基线给全部导出逐个「无参构造」时，因读到一个 getter 而崩在 `AudioContext is not defined`（共跳过 1401 个存取器属性）。故探测**必须走 `Object.getOwnPropertyDescriptor`、跳过存取器**——换到无头浏览器后 `AudioContext` 存在，但规矩不变：getter 的副作用不止音频（懒加载、埋点都可能），且「读一下」本就不该是探针要做的事。
- **「存在」≠「同义」**：`Line` 两边都有，但 CE 是 `Line(start, end)`、manim-web 是 `Line({start, end})`。探针只能数出「有没有、叫什么」；形状差异落在人工残留。
- **「方法存在」≠「这个物体上有」**：方法索引原先跨**所有**可构造导出取并集，于是只存在于代理上的方法（`setOpacity` 只在 `AnimateProxy` 上）被记成普通物体也支持——预检放行、真桥报错。现在**排除 `*Proxy`**，代理的方法面单独从 `Circle().animate` 原型实读。
- **索引容器必须无原型**：方法名里就有 `toString` / `valueOf` / `isPrototypeOf`，普通对象会让 `(index[m] ??= [])` 读到 `Object.prototype` 上的同名函数。

**现状缺口（本轮根因结论，已由 `Step-5` 收口）**：种子 `scripts/official-api-seed.json` 原是**手写清单**（约 250 名，文件自注 "curated 不求全"），「域」没接 CE 包本身 → 覆盖只到「人记得的 CE」；方法也只在 **6 个**手搭实例上测（`circle/line/axes/mathtex/vgroup/tracker`）。**这不是差集无界，而是种子没接真源**——CE 的公开 API 是有限、可枚举的。

> 落地结果（2026-10-09）：类 / 动画 / 函数 / 色 / 速率 / 常量已改为**从 CE 0.22.0 自动枚举**（429 名），方法清单仍人工（CE 的 240+ 公开方法没有能把「模型会写的」切出来的边界）。人工清单另有**漂移门禁**：`export-ce-api.py` 的 `phantom_methods()` 会把对不上 CE 的名字报出来（首次跑出 `get_parts`、`put_start_and_end` 两个幽灵名）。
>
> 还发现「定义域」要区分**三处**、不能只算两处：`manim-web 有` 与 `适配层自带`（`PI` / `TAU` / `DEGREES` / `UP` / `DOWN` / …）。只按 manim-web 判会把 `PI` 记成 missing，技能文档于是写「别写 PI」——而 CE 代码里 `PI` 满天飞。现在适配层自带的常量在表里记 `ok`。

## 5. 取舍与边界

1. **「表外名字」策略保持放行。** 现行 `dry-run-bridge.ts` 注释有据：表只收录探针种子，直接拒绝会误伤「表没收录但 manim-web 其实支持」的写法。本设计**不改放行本身**，只把放行口径**收进 SSOT**，使预检与真桥同判；真正的缺口靠「真桥对真对象校验 + 可读报错」兜住。`Step-5` 把种子换成 CE 包枚举后，「表外」收敛为「非 CE 名」（基本只剩模型自造名），放行口径不变。
2. **on-object 校验无法进预检（诚实边界）。** 预检没有真 manim-web 对象，`typeof target[jsName] === 'function'` 只有真桥能判。所以 SSOT 只统一到「名字级 + 构造规则」；「某方法在某类上是否存在」仍由真桥兜。要把它收进预检，需升级探针按类记录方法可用性（见 `Step-5`）。
3. **本设计（消费侧，`Step-1`–`Step-4`）不做**：不改渲染、不动卡片 UI、不引入新依赖。生成侧（`Step-5`）引入两类**构建期**依赖（无头浏览器、CE 词表），均不进插件产物，已定案见 §6.1。

## 6. 决策与待确认

### 6.1 已定（2026-10-09，用户拍板）

| # | 事项 | 定案 | 理由 / 后果 |
|---|---|---|---|
| 1 | 探针运行环境 | **无头浏览器**（Playwright——与参考项目 `dsh-web-dev` 的 e2e 选型一致） | ① **被测对象与实际运行环境一致**：卡片本就在浏览器里跑，探针就该在浏览器里测，而不是在 Node 里测另一个构建；② 拿到真 canvas / `AudioContext` / MathJax 后，§4.5 ② 那批「无参构造失败」能救回一截。代价：新增一个构建期依赖（浏览器二进制）。 |
| 2 | CE 词表的取法 | **CE 作构建期依赖**：隔离 Python 环境 + 钉死版本号 | 域清单可复现、可随 CE 版本重跑（对应判据 3）。生成物入仓（`scripts/ce-public-api.json`），故常规构建 / 测试**不必**每次装 CE——只有「重跑探针」才需要。 |

### 6.2 待确认

- ❓ `Step-4`（技能文档由表生成）本轮做，还是等 SSOT 稳定后再做？
- ❓ `Step-5` 落地细节：Playwright 版本、CE 版本号、Python 环境工具（`venv` / `uv`）——随第一次跑定下，并写进生成物注释。

（原「是否升级探针按类记录方法可用性」一项已定为 `Step-5`；原「探针运行环境」「CE 词表取法」两项已定，见 §6.1。）
