# 支持面 SSOT · README

把「哪些 Manim 写法被支持」的定义从四处收成一处，让**预检与真桥同判**、改一处四处生效。供跨会话交接。

分两侧：**消费侧**（`Step-1`–`4`，让四个消费方收敛到 SSOT）与**生成侧**（`Step-5`，让表本身接上 CE 真源）。

生成侧两项已定（设计 §6.1）：探针跑**无头浏览器**、**CE 作构建期依赖**。

## 文档

| 文件 | 内容 |
|---|---|
| `设计-支持面SSOT.md` | 问题 / 目标 / 现状地图 / 设计（含 §4.5 来源与生成）/ 取舍 / 决策与待确认 |
| `Step-1-抽出支持面模块.md` | 新建 `surface.ts`（数据 + 判定），真桥改为消费它 |
| `Step-2-预检与真桥同源.md` | 预检改为消费 `surface.ts`，与真桥同判 |
| `Step-3-一致性测试.md` | 表 ↔ 判定 一致性测试，锁死 SSOT |
| `Step-4-技能文档由表生成.md` | （可延后）技能清单由表生成，收掉最后一份手写 |
| `Step-5-升级探针种子与方法索引.md` | （生成侧）CE 作构建依赖枚举种子 + 无头浏览器内全量方法索引 |

## 进度

| Step | 状态 |
|---|---|
| 1 抽出支持面模块 | ✅ 已完成（2026-10-09） |
| 2 预检与真桥同源 | ✅ 已完成（2026-10-09） |
| 3 一致性测试 | ✅ 已完成（2026-10-09） |
| 4 技能文档由表生成 | ✅ 已完成（2026-10-09） |
| 5 升级探针（生成侧） | ✅ 已完成（2026-10-09） |

## 结果与遗留

**结果**：四个消费方（适配层 / 预检 / 真桥 / 技能文档）已收敛到同一份 SSOT——数据是探针实测的三态表（429 项：ok 372 / alias 5 / missing 52），判定是 `surface.ts` 的 `plan*`；表 ↔ 判定由 `surface.test.ts` 全量锁死，预检 ↔ 真桥由 `bridge-parity.test.ts` 锁「同判」，另有拿构建产物对真 manim-web 的抽样核对（14 个名字，不一致 0 条）。技能文档的三段清单（可用 API / 实测缺失 / animate 链白名单）都由表生成，不再手写。

**`alias` = 「放行，而且**真的翻译得出来**」**：`animate` 链、`m[i]`，以及方法改写表接管的 `set_stroke` / `set_opacity` / `put_start_and_end_on`（见下）。放行而翻不出来的写法一律记 `missing`（预检当场拒 + 给改法）——那样「预检放过、真桥才炸」才不会回来。

**换环境纠正了一批历史误判**：Node 直跑基线把 `become` / `to_edge` / `stretch` / `flip` / `interpolate` / `MovingCameraScene` 这类**其实支持**的写法记成 `missing`——旧清单会让预检拒掉合法代码。改到无头浏览器内实测（同一份 manim-web 浏览器构建）后才暴露。

**遗留已清（原「另开一轮」的那批，2026-10-09 完成）**：`rate_func=` 已接线。同批还补了三处「表里说支持、适配层没实现」的同类缺口，并把实现在两处收口：

| 补齐的写法 | 之前的症状 | 现在的做法 |
|---|---|---|
| `rate_func=smooth`（`self.play` 级与逐动画） | Python 侧 `NameError`（速率名没定义） | 速率名由表生成成**字符串标记**过桥，判定 `planRate` 查表翻成 manim-web 的 `rateFunc`；柯里化工厂（`runningStart` 那类）先无参调一次 |
| `m[i]` 取子物体 | `object is not subscriptable` | 适配层 `__getitem__` 按 `INDEX_GETTERS` 依次试 `getPart` → `get` |
| `m.width` / `m.height` / `m.center` / `m.color` / `m.opacity` / `m.points` | **静默错**：`__getattr__` 对任何名字都回一个调用包装，`m.width` 拿到的是函数 | 表 `PROP_READS` 定「走方法还是存取器」（`getWidth()` / `color`），未登记的名字当场报错 |
| `self.clear()` | `'Scene' object has no attribute 'clear'` | 适配层补 `clear()`（表里 `clear` 实测为 ok 的 scene-method） |

同批另修两处**执行期**形状问题（不改支持面，只在真桥）：动画构造改走 manim-web 的**同名工厂函数**（类构造器的参数形状与 CE 不同，只有基类 `Animation` 没有工厂），动画位置参数里的对象改用 `__handle` 标记、组动画用 `__animations` 标记（原先靠「数字=句柄、数组=组动画」猜，于是 `Rotate(c, PI)` 把 PI 当句柄）。

**归类改按实测，不按 CE 的模块分组（2026-10-09 补，真机报障驱动）**：用户在真机上跑 `traced = TracedPath(dot)` + `self.add(traced, dot)`，卡片报「未知的对象句柄 `<manim._Animation object at 0x...>`」（渲染前两段还能出来，所以是「画出来了但报错」）。

根因是**归类被 CE 的模块路径骗了**：CE 把 `TracedPath` / `AnimatedBoundary` 放在 `manim/animation/changing.py` 里，两者其实 `extends VMobject`。探针按「CE 把它挂在哪个模块下」定 kind ⇒ 记成动画 ⇒ 适配层生成 `_Animation` 工厂 ⇒ `self.add` 拿到的是一个没有句柄的**动画描述**，原样过桥就查不到句柄。

| 修法 | 内容 |
|---|---|
| 探针按实测归类 | 在无头浏览器里沿**原型链**实测（`Mobject` / `Animation` 谁在链上）定 kind——**域清单只回答「要测哪些名字」，不回答「它是什么」**。全表 208 个可核对项只有这两项错分，重跑探针即自动纠正 |
| 归类错了会被门禁拦住 | 新增 `api-map.test.ts`：拿 manim-web 复核每个 class/anim 项的 kind（206 项），不重跑探针也能拦漂移；并单独锁住出事的这两个名字「必须在可核对集合里」（防它们又变得测不出来而静默跳过） |
| 技能文档跟着正 | 这两项从「动画」挪到「图形与组合」（各 −2 / +2）——技能文档是模型学习支持面的唯一入口，归错类会让模型把它们写进 `self.play(...)` |
| 补 `leading` 构造形状 | `CtorSpec` 的 `leading` 原先**只在类型里声明、`planCreate` 里没实现**（注释还举了未登记的 `Brace(mob)`）。现已实现，并登记 9 个「包住物体」的类（`TracedPath` / `AnimatedBoundary` / `SurroundingRectangle` / `BackgroundRectangle` / `Cross` / 四个布尔运算）——它们在表里本是 `ok`，但 CE 的位置参数写法会撞「位置参数暂不支持」，关键字写法同样不对（构造器要的是**位置**的物体，不是选项里的键） |
| `Scene.add` 当场校验参数 | 收到动画给可读报错（`add 只接受物体（Mobject），收到 _Animation——动画请用 self.play(...)`）。校验在**纯 Python** 里，所以预检也拦得住——原先是预检放过、到渲染期才抛出那句看不懂的报错 |

**方法改写：名字级 `ok` 掩盖了「按类才有」（2026-10-09 补，真机报障驱动）**：用户在真机上跑一段标准 CE 的「单位圆 + 正弦追迹」动画，第 28 行 `connector.set_stroke(opacity=0.5)` 报 `set_stroke() 在 manim-web 无对应方法`，且整段没画出来。

根因有两层：

1. **表是名字级的，manim-web 的可用性是按类的**。`set_stroke` 的 camel 猜测 `setStroke` 确实存在——但只在 6 个类上（`AnnotationDot` / `Arrow` / `DiceFace` / `DoubleArrow` / `ManimBanner` / `MathTexPart`），`Mobject` / `Line` / `Dot` 根本没有。探针「命中 ≥1 个实例就记 ok」⇒ 记成 `ok` + `js: setStroke`；而 `planMethod` **不看 `targets`**、也不看接收者是谁 ⇒ 预检放行，真桥才炸。
2. **缺一层真翻译**。CE 的 `set_stroke(color, width, opacity)` 是 **VMobject 级**（所有物体都有）；manim-web 的 Mobject 没有 `setStroke`，但 `setStyle` 收 `strokeColor` / `strokeWidth` / `strokeOpacity`。同类还有 `set_opacity`（CE 统一一个，manim-web 拆 stroke / fill 两个 setter）与 `Line.put_start_and_end_on`（manim-web 只在 `Arrow` / `Vector` 上同名，`Line` 要用 `setStart` + `setEnd`）。这三条**代码本身都是标准 CE**，是转换不完整。

| 修法 | 内容 |
|---|---|
| 判定层加**改写表** | `surface.ts` 的 `METHOD_REWRITES`：CE 方法 → manim-web 的**调用候选组**（一组 = 一次或多次调用）。`put_start_and_end_on` 给两组（`putStartAndEndOn` / `setStart` + `setEnd`），由桥挑接收者真有的那组 |
| 桥按候选组落地 | 真桥逐个试「这组方法都在接收者上」，第一组生效即执行；都不在才报可读错。预检只做名字级校验（无语境），两桥对**名字**同判 |
| 表跟着诚实 | 探针新增 `REWRITTEN_METHODS`：这三个名字记 `alias` + 落点说明（不再让 camel 猜的名字冒充 `ok`）。表 **ok 374→372 / alias 2→5 / missing 53→52**；技能文档里它们从「方法」段挪进「照 CE 写、适配层自动翻译」段 |
| 方法不再「窄得莫名其妙」 | 全表 45 个 `ok` 方法里 **18 个不在基类上**；多数是**合理**的窄（`plot`/`c2p` 只在 Axes、`arrange` 只在 VGroup、`set_value` 只在 ValueTracker），真正错的只有 `set_stroke` 与 `put_start_and_end_on`（CE 里前者所有物体都有、后者 Line 也有） |

**这次是「代码对、转换缺」——与上一轮的 `TracedPath` 正好相反**：`TracedPath(dot)` 传的是**物体**（manim-web 的形状），而 CE 要的是**函数**（`dot.get_center`），那是**代码本身不标准**、转换照 manim-web 收了；`set_stroke(...)` / `Line.put_start_and_end_on(...)` 则是**标准 CE、转换没翻**。两个方向都存在，判据只有一条：**以「CE 写法 → manim-web 能不能落地」为准，不以「名字像不像」为准**。

**仍未接线（已知边界）**：① 表外名字一律放行（同上一条）；② 改写方法的候选组「接收者一个都不支持」时——如对 `Circle` 调 `put_start_and_end_on`——预检没有对象可查、会放过，真桥拒。二者都是「预检无语境」的同一代价，模型侧靠技能文档的清单约束。**注：②在本轮之前就存在**（`put_start_and_end_on` 当时也是名字级 `ok`），本轮只把 `Line` 这一侧修对了。


## 事实来源

- 上游设计：`../2026-10-09-01-manim渲染插件/顶层设计.md`
- 相关源码（消费侧）：`plugins/manim-renderer/src/core/py/`（`api-map.generated.ts` / `manim-bridge.ts` / `dry-run-bridge.ts` / `manim-shim.ts`）、`src/core/index.ts`、`src/host/index.js`
- 生成侧（探针）：`plugins/manim-renderer/scripts/probe-api.mjs`、`scripts/official-api-seed.json`；构建期依赖 = Manim CE（域清单）+ Playwright（无头浏览器），见 `设计-支持面SSOT.md` §6.1
- 机制 / 构建 / 验证：`.agents/skills/cordis-plugin-development/SKILL.md`
