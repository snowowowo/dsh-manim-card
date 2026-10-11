# dsh-manim-live — Manim 渲染

给宿主加一个能力：**AI 在聊天里直接写 Python 的 Manim 代码，当场渲染出画面**。只装这一个插件就能用，不依赖黑板或其他插件。

它把旧黑板里三件事合成一个包：**运行时**（真 Python 解释器执行 AI 写的 Manim Python）、**渲染器**（跑在真 manim-web 上画进画布）、**入口与出口**（Host 工具 + 聊天流卡片）。对外服务 `manim`（供第三方插件消费）已提供：`check(python)` 干跑预检 + `createSurface(container)` 造一块画布。

## 状态

**进行中**：Python 运行时（**核心包 `manim-live` 的 `src/py/`**，Pyodide 执行 + manim 适配层 + 桥，自带测试）、渲染引擎（**核心包 `manim-live` 的 `src/engine/`**）、KaTeX 与 Pyodide 资源路由、**聊天卡片**（AI 调 `manim_render` → 聊天流出一张卡；**自动播只发生在「刚生成的那张」**——它第一次进视口正常播一遍，之后重挂载的一律极速落末帧，老会话里的卡根本不跑；播放与画布数量交给一份全页**渲染调度器**：以阅读位置为中心预热 6 张、可见的优先、**滚出视口不拆**（只在画布超上限时收掉离得最远的）、**同一个 step 并行发的几张只真播最后那张**；全页共用一条 Python 队列，不会两张卡抢同一个解释器）、**技能**（`skills/manim-live/`，把可用 API、写法边界与**场景模板**讲给模型）与**Host 侧预检**（返回前用空桥干跑一遍，不通过当场回 `error`）都已就位；**随包外的 Python 库按需取**（`import pandas` 这类首次联网取一次、按 sha256 校验后落进 `~/.dsh/cache/manim-live/pyodide/`，之后离线命中，取的期间卡片上提示「正在加载 X…」）也已接线；**设置面板**里的「Manim 渲染」一节（**本机环境探测** + **包缓存清单与预缓存**）也已就位，见下。

写法上除属性动画 `self.play(m.animate.x(...))`（可链的方法由探针实测 manim-web 的 animate 代理生成，不在表里的当场报错并列出可用项）外，`rate_func=` / `run_time=`、`m[i]` 取段、`m.width` 这类属性读取、`self.clear()` 也都已接线——「这个写法支不支持」的判定与真执行取同一份支持面（核心包 `manim-live` 的 `src/py/surface.ts`），所以**预检放行的，真桥不会当场拒**。**方法改写**（`surface.ts` 的 `METHOD_REWRITES`）负责「CE 有、manim-web 换了形状」的那批：`set_stroke(color=, width=, opacity=)` → 颜色走**属性写**、`_color` 与 `strokeColor` 各写一份（渲染层读前者、回读走后者，见第六轮第 7 条）、宽 / 透明度走专属 setter——**不能**落 `setStyle`：manim-web 的 set color 存取器会把 fillColor 一起冲掉（见第四轮 (b) 的色板事故）；`set_opacity(x)` → stroke + fill 两个 setter、`put_start_and_end_on(a, b)` → Arrow 走同名方法、Line 走 `setStart` + `setEnd`。物体/动画的归类按 manim-web 的**实测原型链**定，不看 CE 把它挂在哪个模块下（CE 把 `TracedPath` / `AnimatedBoundary` 放在 `animation/` 里，两者其实是物体）；「包住一个物体」的写法（`TracedPath(dot)` / `SurroundingRectangle(text)` / `Union(a, b)` …）也走同一份构造规则。`self.add(...)` 收到动画会当场给出可读报错（校验在 Python 侧，预检也拦得住）。左侧导航「Manim 渲染」是**实验场**（见下节）——本插件功能的肉眼验收台。

顶层设计见 `_docs/工作文档/2026-10-09-01-manim渲染插件/顶层设计.md`。

### 实验场（功能验收台）

左侧导航「Manim 渲染」那一页是**实验场**：左边样例清单、右边渲染预览，点哪条跑哪条，通过 / 未通过当场标在条目上。它不是一个另做的调试页——**画布就是聊天卡片那个组件**（`components/card.tsx`），所以手动播放 / 查看代码 / 导出这些能力天然一致（页面对卡片只多传了 `autoStart`：一次只挂一张卡，不必再等视口）。

页面顶部是**模式切换**（`components/segmented.tsx`，分段控件）：`样例` 与 `自定义代码`。两者互斥（同一时刻只挂一张卡），所以「自由编辑」不再是常驻在一旁的第二块编辑区。说明性长文案一律收进 `components/tip.tsx`（悬停 / 键盘聚焦才出现），页面上只留控件。

工具条（图标 + 悬浮提示）：**停止** / **清除记录** / **极速** / **清除已下载的库**。

- **进度落盘**：逐条结果（只存 ok）、极速开关、自定义代码、当前模式都存 `localStorage`（`storage.ts`），刷新或中途崩了不用从头再来；「清除记录」清空。
- **极速**：不等 `run_time` 与 `wait`，直接落到终态——切换开关会把当前条按新口径重跑一遍。实现见 `manim-bridge.ts` 的 `fast`：动画时长压到 0（manim-web 对 `duration <= 0` 取 `alpha=1`），`wait` 则把场景里的 updater 按固定步长推到时长之后再渲染一帧——**不能一省了之**，`TracedPath` 这类轨迹本来就是在 `wait` 里长出来的，省掉就是空的。看动画过程时关掉这个开关。
- **通过 / 未通过按「预期」判**：预览上方显示当前样例的 expect 一句话（人工验收对照用）；标了 `reject` 的那条**跑不通才是通过**（它验的就是「当场拒掉、且说得清」）。
- **样例内置**（`client/samples.ts`，约十条）：python 逐字取自核心包仓 `corpus/examples/` 的语料文件——基础图形 / 变换 / 坐标系 / MathTex / 列表 / 柱状图 / TracedPath / updater 数字 / 3D 各一条，外加一条引用未定义名字的坏代码（验预检报错路径）。打进 `client.js`，**正式安装里同样可用**。

**语料回归网与本页无关**：236 条那套语料（19 组）归核心包 `manim-live` 仓所有（`corpus/examples/`），回归、截图、覆盖率计量都在那边跑（`cd ../manim-live && pnpm test`）。本插件不再有语料路由——以前那套「运行时向 Host 取语料、正式安装退化成自定义代码」的机制已随本次收窄删除。

语料本体是**核心包 `manim-live` 仓里 `corpus/examples/` 下的完整 Manim 文件**（19 组 / 236 条：离线 221 条 = 178 条应通过 + 43 条应拒绝，其中 1 条标了 `@browser`、Node 套件跳过；另 15 条需联网），独立可跑：

```bash
manim ../manim-live/corpus/examples/basic/01-circle.py CircleScene
```

**为什么归核心包仓**：这批文件是开发期的回归网（外加讲解模板的出处），不是产品功能——跟着插件发布，等于让每个用户都背上一个只有开发者才用的实验场，还要把上百条源码打进 `client.js`。验的又是核心包那条管线，所以抽核心包（Phase 1 Step 2）时它随运行时一起搬了过去。语料根可用环境变量 `MANIM_CORPUS`（绝对路径）覆盖，解析顺序与「谁在读它」都收在核心包 `manim-live` 的 `src/testbench/corpus.ts` 一处（消费者：Node 回归 / gen-skill / 截图脚本 / 核心包自己的 playground，**不许再各写各的路径**——必然漂移）。

文件即元数据：docstring 第一行是标题，`@expect <一句话>` 是**预期表现**（236 条全部已写），`@reject <关键词>` 标记「这条应当被当场拒绝」并钉住报错里必须出现的词，`@note` 写出处，`@template <什么时候照它抄>` 把一条标记成**技能模板**（见下）。目录即分组（目录没在核心包 `testbench/corpus.ts` 的 `GROUPS` 里登记就报错，免得新加的文件夹被静默漏掉），页面（浏览器）与自动测试（Node）读的是同一批 `.py` 文件，不存在「页面那份和测试那份不一样」。

分组按「验什么」分层：`basic`–`scene` 八组是**语法与方法面**（构造、方法改写、坐标系、文字、更新器、动画、场景）；`lesson` 是**通用讲解范式**（也是技能模板的出处）；`math-calculus` / `math-linear` / `math-prob` / `math-group` / `math-discrete` 五组是**具体学科的真实讲解画面**（高数 / 线代 / 概率 / 群论 / 离散，各 12 条——泰勒展开、特征向量、正态分布、凯莱图、递归树这类上课真会画的东西）；`syntax` / `api` 是离线兜底（语法综合 + 三态表点名）；`net` / `combo` 需联网；`reject` 验「拒得对」。

**模板按 `@template` 标记精选，不整组内联**：技能 `SKILL.md` 的「场景模板」节（`<!-- gen:templates -->`）由 `scripts/gen-skill.mjs` 生成，**只收 docstring 里带 `@template` 的条目**，标记后面的那句「什么时候照它抄」原样写进技能——想说一条是模板，就得先说清它代表哪种范式（静态定义图 / tracker 扫描 / 参数曲线 / 极限 / 细分逼近 / 线性变换 / 随机模拟对照，当前 7 条）。模板与语料因此是**同一份文件**：先当普通语料在回归网里跑通、真浏览器里截过图，才谈得上进模板区；改模板 = 改语料，验证自动跟上，不存在「技能里那份」和「测的那份」两份。

- **页面**：逐条肉眼验，失败能看到完整报错；
- **自动测试**（`examples.test.ts`）：同一条目跑真管线（真 Pyodide + 真 manim-web），一条失败一条红。

⚠️ **假画布是盲区**：`examples.test.ts` / `manim-bridge.test.ts` 把 `play` / `wait` 换成空函数（只验「收没收、炸不炸」），所以**动画与 updater 到底有没有真的跑，那两份测试验不到**。带 updater 的语料曾在假画布下全绿、在真画布下必炸（见 `important-thing` 的 updater 条目）；**点数对齐型动画**（`Transform` / `ReplacementTransform` / `FadeTransform` / `ClockwiseTransform` …）同样是「假画布看不见」的那种——它们抛在渲染循环里，`play` 的 promise 永不 resolve，页面一直转（见下）。因此另有一份 `headless.test.ts`：用 manim-web 的 `Scene.createHeadless()` 在 Node 里建**真场景**（不碰 DOM / WebGL，但时间线、动画、updater 都是真的），把「单参 lambda 会被补齐、updater 拿到的是 Mobject 包装、**`UpdateFromFunc` / `UpdateFromAlphaFunc` 的回调拿到的也是 Mobject 包装**、极速推的是整段时长、点数对齐型动画在对不齐的一对上不抛（且对得齐的仍真 morph）」逐条钉死。

加一条语料的时机是「AI 写了、我们没接住」——**原文**放进去，不要改成能跑的样子（改好就测不出问题了）。这样「补一次」就变成「钉死一次」，而不是补完即忘。首批 98 条一口气抓出 5 个真问题（构造器位置参数缺登记、`restore` / `weight` / `slant` 改名、`ApplyMatrix` / `ChangeDecimalToValue` 参数形状、`Table` 单元格的句柄没打标），都已在同一轮修掉；随后 updater 的「参数个数 + 参数类型」两个坑也是靠语料抓出来的。

第二轮再补 42 条（**30 条 `reject`** 逐项覆盖三态表里的 `missing` 项 + **12 条 `lesson`** 讲解场景），又从真实轨迹里抓出 4 个：Host 预检用的空跑桥把 `ax.c2p(...)` / `tracker.get_value()` 当句柄返回，于是一段正当的 `(p+q)/2` / `x**2` 算术被误判成「Mobject 不能乘方」——**预检放不放行、与真桥跑不跑得通必须同判**，这次把「有返回值的那些方法各自返回什么形状」在 `surface.ts` 立了一张 `METHOD_RETURNS` 表，两边共用；`from manim import *` 其实带 `np`，适配层只绑了 `_np`；`ThreeDScene` 等场景族在技能里写着可用、适配层却没定义；类壳检测正则只看 `(Scene)`，`class X(ThreeDScene)` 被误当成裸构造体。前两个都先复现出**同一份真实报错**（读会话轨迹 `~/.dsh/sessions/…/session.v4.jsonl.zstd` 解压出模型当时写的代码），再改、再拿语料钉死。

第三轮是**真画布**才看得见的一类：`FadeTransform`（换公式那步）在真机上抛 `alignVmobjectPair: alignPoints fallback produced mismatched point counts (905 vs 589)`。继续挖发现**不是 FadeTransform 一支的问题**——`Transform` / `ReplacementTransform` / `FadeTransform` / `FadeTransformPieces` / `ClockwiseTransform` / `CounterclockwiseTransform` 都会在 `begin()` 里**直接调点数对齐、没有兜底**（实测 `Transform(Arrow, Star)`、`ClockwiseTransform(VGroup(3), VGroup(1))` 都抛）。但它们**不是不可用、而是挑输入**：VGroup 对走「按子物配对」、`Circle → Square` 也能对齐，都正常。所以**不能按名字拉黑，得按实际那一对判**——见下。

修法在支持面立一张 `POINT_MORPH_ANIMATIONS`（登记这一族、并记下「两端是 `VGroup` 时是否就安全」），桥按实际那一对判：`VGroup` 对且这支按子物配对（`Transform` / `ReplacementTransform`）⇒ 直接走真动画；其余情况拿**复制品试跑一次 `begin()`**——对得齐走真动画（保住 morph），对不齐才退到 `AnimationGroup([FadeOut(源), FadeIn(目标)])` 的交叉淡入淡出。判据用 manim-web 自己的 `begin()`，不另写启发式。**复制只对「不发起异步排版」的物体做**：`MathTex` / `Tex` / `Text` 的复制品会各自再排一次版，Node 里必然失败、且是接不住的未处理拒绝（测试全绿但 `pnpm test` 退出码非零）——这类改走保守侧兜底。**这类坑假画布一律验不到**，所以配的是 `headless.test.ts` 的真场景用例：四对「抛过的」（`VGroup(3)→VGroup(1)`、`Arrow→Star`，含 Transform / ReplacementTransform / Clockwise / Counterclockwise 各支）＋**一对「对得齐的」**（`Circle → Square(side_length=4)`，断言宽度真的 morph 到 4，证明没被误退兜底）。

同一条真机代码上还叠着**第二个坑**：`UpdateFromAlphaFunc(result, lambda m, alpha: m.set_opacity(...))` 里的 `m` 是 manim-web 的**裸 JS 对象**。manim-web 这两个类的回调签名就是 `func(mobject, alpha)`（`interpolate` 里 `this._func(this.mobject, alpha)`），裸对象上只有 camelCase 方法，CE 名的 `set_opacity` 当场 `AttributeError`——**与 `add_updater` 是同一个坑的另一个入口**，同样抛在渲染循环里（`headless render loop error ... AttributeError`），循环被停掉、`play` 的 promise 永不 resolve，现象就是「一直转」。修法与 `_register_updater` 同一套：在 `_FUNC_ANIMATIONS`（`UpdateFromFunc` / `UpdateFromAlphaFunc`）里把回调包一层，闭包换成本次动画目标的 `Mobject` 包装，并按回调自己的签名裁参数个数（CE 里 `UpdateFromFunc` 习惯写单参，而 manim-web 固定按双参调）。语料补了 `examples/updater/06-update-from-func.py` 当模板，真场景回归钉了 3 条（`set_opacity` 打得开 / 单参回调收得下 / 与点数对不齐的 morph 叠在一起也跑得完）。顺带记一条**测试环境**的坑：真 headless 场景里构造 `MathTex` 必然产生未处理拒绝（Node 无 DOM，异步排版失败），会让整轮 vitest 退出 1——所以真场景用例里不用文本物体，文本那一对交给假画布语料回归与真机自测。

第四轮分两条线。

**(a) 覆盖面**：原语料一条一行、各点一个写法，长尾太多。补了 `syntax`（只用 manim + 标准库，离线）、`combo`（pandas / scipy / sklearn / statsmodels / matplotlib 多库协同，需联网）与 `api`（**API 点名**）三组。点名不是凑数：把三态表里 `state=ok` 的名字**成批**在真实代码里用一遍（76 个颜色、16 个速率、方法面、几十个形状类、两批动画），名字写错或桥没接上会当场报错，等于给整张可用表加了一层回归网。语料对可用 API 的覆盖因此从 **36.9% 提到 89.4%（337/377）**；剩下 40 个多是「需要外部文件（SVG / 图片）」「需要按类登记构造形状」「回调形状对不上」三类。**第五轮把这 40 个逐个接掉**——见下节。

**(b) 语料抓到的真问题**（都已修 + 钉死）：

- `VGroup` 遍历**永远不结束**：适配层越界取子物体只把 `None` 原样返回，而 Python 的迭代协议靠 `IndexError` 收尾——`for m in group:` 会一路取下去把内存吃满、整轮 vitest 卡死。修法：`__getitem__` 取不到就抛 `IndexError`，并补 `__iter__`；预检桥 / 记录桥对登记过子物体数的组同判（返 `undefined`）。回归语料 `syntax/06-group-iteration.py`。
- `len(group)` 抛 `TypeError`：manim-web 的 `VGroup` 本来就有 `get length()`，适配层没接。补 `PROP_READS` 的 `length` + `Mobject.__len__`（顺带一处细节：JS 数字过桥是 Python `float`，`__len__` 必须 `int()` 一道），三处桥同判。
- `plot_line_graph(x, y)`：三态表按「方法在不在」记 ok，但 manim-web 收的是**一个选项对象** `{xValues, yValues, …}`，CE 写法会落到不存在的参数上、静默画错——补 `METHOD_REWRITES` 一条。
- `CyclicReplace(a, b, …)`：CE 是变长位置参数、manim-web 收**一个数组**；不包数组时第二个物体被当 options，报错（typia 在它的 `shift` 字段上）完全看不出根因——补 `ANIMATION_ARGS` 一条。
- **回调在前的那一族**（`ApplyFunction` / `Apply*PointwiseFunction` / `ApplyComplexFunction` / `Homotopy` 家族 / `PhaseFlow`）：CE 把回调放**第一位**（`ApplyFunction(func, mobject)`），manim-web 的工厂反过来（`applyFunction(mobject, func)`）。顺序错了**假画布一点看不出来**——动画只构造、不跑到 `begin()`，于是预检与语料回归全绿，真画布一跑就是 `e.children is not iterable`（把回调当成了物体）。补 `ANIMATION_ARGS` 八条换序，并在 `headless.test.ts` 加真场景回归（假画布永远拦不住这一类）。顺带发现 `PhaseFlow` 的回调收**一个**参数（`lambda p: p`），不是 `lambda p, t:`。
- **色板全黑**（第五轮，用户真机肉眼抓的）：`api/01-colors.py` 的 76 个方块渲染成一整片黑。在真物体上探针验证：`set_fill(RED, 1.0)` 后 `fillColor` 是 `#FC6255`（对的），但紧接着的 `set_stroke(width=0, color=BLACK)` 之后**填充也变成了黑**——manim-web 的 set color 存取器一行写两个通道（`this._style.strokeColor = e, this._style.fillColor = e`），而 `setStyle({strokeColor})` 内部正是 `this.color = …`。「只改描边」把填充一起冲掉。修法：`MethodCall` 增加**属性写**形态（`prop: true`，`target[js] = args[0]`），`set_stroke` 的颜色改走 `strokeColor` 属性写；同时补 `PROP_READS` 的 `fill_color` / `stroke_color` / `fill_opacity`——「上了色没有」要能从 Python 里读回来（顺带修了 shim 把 JS 名传给 `getAttr`、查不到表的接线错）。真场景回归两条：链式上色后填充不被冲掉、三个属性读得到真值。**这类「跑通了但画得不对」假画布与断言都拦不住，要靠人眼或截图核对。**

### 预期表现与人工验证（第五轮起）

「跑通」只说明没炸；**画得对不对**是另一回事——色板全黑就是全绿语料里被人眼抓出来的。配套两件事：

- **每条语料带「预期表现」**：docstring 里 `@expect <一句话>`（核心包 `src/py/corpus-format.ts` 解析）。236 条全部已写。实验场的内置样例各带一句同源的 expect，展示在预览上方。

### 第五轮：把语料 API 覆盖率推到 100%

上一轮剩下的 40 个名字，一半是「形状对不上」（下面会解释这是什么），逐个对着 manim-web 的 `dist/*.d.ts` 读准签名后接掉。

**「形状对不上」= 同一个操作，两边要的参数形状不同**——不是 Python 语法问题（你写的都是合法 Manim）。底层是 manim-web（JS 移植版），同一个能力经常换了个收参方式。四条典型：

| 你写（CE 惯例） | manim-web 实际要 |
|---|---|
| `ApplyFunction(函数, 物体)` | `applyFunction(物体, 函数)`——参数反着 |
| `TangentLine(圆, 0.25)` | `new TangentLine(圆, { t: 0.25 })`——第二个数搬进选项对象 |
| `ChangeSpeed(动画, speed_factor=2)` | `changeSpeed(动画, 速度函数)`——数字要变成函数 |
| `LaggedStartMap(FadeIn, 一组)` | `laggedStartMap(**动画类**, 物体数组)`——收类而不是名字 |

**解法**是在适配层加一条「改写」：判定层（`surface.ts`）把 CE 形状翻译成 manim-web 形状，桥只负责执行。每条遗留都是一小块工作，不是重构。

**(a) 形状类**（登记进 `CTOR`）：
- 新形态 **`leading + optKeys`**：前几个位置参数直传、**多出来的落进同一个选项对象**——`TangentLine(vmobject, t)` → `new TangentLine(vmobject, { t })`、`BraceLabel(mobject, label)` → `new BraceLabel(mobject, { label })`；`BraceText(mobject, text)` 则是两个位置参数（选项对象排第三）。
- 一批「CE 收位置参数、manim-web 收选项对象」：`ArcBrace` / `ConvexHull3D` / `Line3D` / `Arrow3D` / `TangentialArc` / `RegularPolygram` / `Polygram` / `VDict` / `SingleStringMathTex` / `Code` / `Variable`。
- 只收关键字的一批（关键字形式本来就能过，补语料即可）：`LabeledLine` / `LabeledArrow` / `LabeledDot` / `LabeledPolygram` / `Graph` / `DiGraph` / `SampleSpace` / `PGroup`。
- `VectorField` / `ArrowVectorField` / `StreamLines`：收一个**函数**。CE 的 `func(p)` 收一个点、manim-web 的 `func(x, y)` 收两个数、且**必须返回真数组**（Python `list` 过桥只是个代理对象，manim-web 解构不了）。适配层按回调签名裁参数个数、返回值过一遍 `to_js`。

**(b) 动画**（形状差得最远的那几支，各接一处）：
- `Wait(run_time)`：CE 里是「什么都不做的动画」，manim-web 是**场景方法**（还要求一个物体挂靠）。`Scene.play` 里把它摘出来、直接落到 `wait`。
- `LaggedStartMap(FadeIn, 一组)`：manim-web 收**动画类**，而类过不了桥 → 适配层把类折成名字标记、把 VGroup 折成**子物体数组**；判定层把 CE 名换成导出名（`FadeIn` → `fadeIn`，工厂名小写开头）；桥按名字取回真类。
- `ChangeSpeed(动画, speed_factor=2)`：CE 给数字、manim-web 要速度**函数** → 数字带成 `{ __speedFactor: n }` 标记，由桥那一侧现造 `() => n`（与 `rate_func` 的 `RatePlan` 同一套路：Python 造的函数过不了桥）。
- `ChangingDecimal(decimal, f(t))`：manim-web 的 `changingDecimal` 只收线性 `{startValue, endValue}`，表达不了任意 `f(t)` → 落到 `updateFromAlphaFunc`（每帧把数字设成 `f(alpha)`），语义与 CE 一致。
- `TransformAnimations(a1, a2)`：位置参数里夹着**两份动画**——按结构认（句柄 / 组 / 类名标记都不占 `kind` `targets` `kwargs` 这三键），判定层递归校验、桥递归构造。
- `ShowPartial(mob, start, end)`：CE 两个位置比例 → manim-web 的 `{ startPortion, endPortion }`。
- `Restore` / `MoveToTarget` / `Animation`（基类）：前两个要 `m.save_state()` / `m.generate_target()` + `.target`。补了 `PROP_READS.target`（manim-web 的字段叫 `targetCopy`）——读出来是**物体**，所以属性读统一过一遍 `_wrap`；不过的话拿到的是个 dict，`m.target.shift(...)` 直接报 `'dict' object has no attribute 'shift'`。
- `get_parts()`：manim-web 的 `getParts` 挂在**单段** `MathTexPart` 上、不在 MathTex 本体上，所以按段迭代出来（`[self[i] for i in range(len(self))]`）——这正是「分段协议」的两件事（取第 i 段 + 有几段）。

**(c) `Polyhedron`：从「不点」改成「可读拒绝」**。它在 manim-web 里**有**这个名字，却是抽象基类——构造即 `this._createGeometry is not a function`，用户完全看不出该怎么办。现在按抽象基类生成「用一下即抛、并列出具体替代类（Cube / Sphere / …）」的存根（与 `state=missing` 共用同一套 `_stub`，措辞分开），`reject/40-polyhedron.py` 钉住。

**覆盖率结果**：当时算到 **100%（377/377）**；随着语料在本轮布局体检里清掉了几条「画出来什么都没有」的点名（`BackgroundRectangle` / `PGroup` / `ChangeSpeed` 包裹等），当前实测为 **98.7%（372/377）**。没覆盖的 5 项各有明确原因：`VMobject` / `VectorizedPoint` / `TipableVMobject` / `PMobject` 构造成功但**定义上没有几何**（画出来是空，语料没法治「什么都不显示」），`m[i]` 下标别名要求**字面量下标**、语料不便用非字面量写法点名——四类都是「名字能用、画面无物」或「写法受限」，不是漏接。

**`@browser` 头标记**：`SVGMobject` 要用浏览器的 `DOMParser` 解析整段 SVG 字符串，Node 里没有 DOM。所以加了 `@browser`——Node 套件**跳过它并打印出跳过了谁**（不静默漏跑），这条改由真浏览器核（核心包仓的截图脚本）。`VMobjectFromSVGPath`（只给一条路径 `d`）不需要 DOM，照常进自动测试。

**仍列在已知遗留**：`get_bounding_box()`——manim-web 返回 `{width, height, depth}` 对象，不是 CE 的 2×3 数组；要宽高分别读 `width` / `height`（已登记）。需要外部文件（图片 / 字体）的那几个类同理，等真机代码逼到再补。

### 第六轮：截图自查——「跑通 ≠ 画对」

上面每一轮的教训都是同一句：**语料套件只回答「跑通了没有」，画得对不对它管不着**——颜色被冲掉、终态落在错处、形状造歪，全部跑到最后一行、退出码 0。所以加了一台**相机**：核心包的 `scripts/shot-corpus.mjs` 用无头 Chromium 加载与卡片**同源**的整条管线（同一份核心包产物、同一个 `manim-web.browser.js`、同一套画布调用形状），把可视化语料逐条真渲染、每条落一张 PNG 并量**墨迹占比**（画布上非透明像素的比率，≈0 即整张空白）；核心包的 `scripts/shot-sheets.py` 再拼成 3×2 对照表，逐条对着 `@expect` 人眼核。跑法：`node scripts/shot-corpus.mjs`（全量离线组）/ `<组名…> --only <子串>`（只截某几条）/ `--probe <某个.py>`（打印 print 输出与场景物体清单，调「画得对不对」用）/ `--realtime`（不压速，核动画过程）/ `--clean`（整目录清空，默认只覆盖同名文件）。

### 第七轮：截图落盘 + 全量布局体检

截图从一次性产物升级成**持久资产**：产物默认落核心包 `manim-live/corpus/shots/<组>/<同名>.png`（与 `.py` 同名，路径唯一真源是核心包 `testbench/corpus.ts` 的 `shotPath()`；`MANIM_SHOTS` 可覆盖），每次重截覆盖同名文件——**图永远跟着语料是最新的一版**。图进 git、截图清单（`index.json`）不进。

同一轮做了**全量布局体检**：179 条离线语料逐条截图，六个核图代理对着 `@expect` 看图，抓出约 45 处只在画面上可见的缺陷（物体静默消失、丢填充、跑出画布、标签被盖、公式整条不显示、坐标比例错、数学本身画错），逐条「看 → 改 → 重截 → 再看图」闭环修掉 51 条。体检结论沉淀成 `SKILL.md` 的「布局红线」一章：MathTex 定位只用 `move_to`（包围盒是 KaTeX 异步量出的，`to_edge` / `arrange` 会拿到 NaN 把整条公式挪出画框、退出码 0）、中文不进 MathTex、`\mathbb` / `\mathcal` 不画字形、一个物体只进一个组、高亮别用 `Indicate`、3D 物体默认叠在原点必须逐个 `shift`、`BarChart` 默认摆位偏右上……每一条都是真浏览器截图才抓得到的，Node 回归全绿照样犯。

**新纪律**：语料改动要过两道门——Node 回归（不炸）**加**真浏览器截图（画对，对着 `@expect` 看）；探针文件用完即删，不进提交。

这一轮抓出并修掉**九个「跑通但画得不对」**（全部在 `upstream-fixes.test.ts` 里用真 headless 场景读出数值钉死；假画布与断言永远拦不住这一类）：

1. **回程型 `rate_func` 不回起点**：`.animate.shift(RIGHT*3, there_and_back)` 跑完停在 x=3——上游 `AnimateProxy.finish()` / `Transform.finish()` 直接钉到目标态，无视基类 `update()` 按 `interpolate(rateFunc(1))` 摆好的中间态。补 `settleRateTerminal()`：play 回来把终值 ≠1 的速率重新插值到 `rateFunc(1)`（常规速率一律不动，不误伤 `Indicate` 这类终值恰为 1 的瞬态动画）。
2. **`.animate` 链的关键字算成 NaN**：`.animate.set_fill(BLUE, opacity=0.6)` 的 kwargs 被当尾参对象塞进写死的位置参数 builder → `fill_opacity` 是 NaN、动画照跑画面没填充。补 `ANIMATE_SIGNATURE` + `animateCallArgs()`：按 builder 签名把关键字摊成位置参数。
3. **`.animate.set_opacity()` 整条链抛错**：`AnimateProxy` 有 `setOpacity` builder，`Mobject` 上却没有这方法 → 重放在渲染循环里炸。整次调用改写成 `setStyle({stroke_opacity})`（`ANIMATE_CALL_REWRITES`）。
4. **`self.remove(x)` 静默不删**：shim 把裸句柄号传给了只认 `{__handle}` 标记的通用通道 → `scene.remove(3)` 收到整数不报错也不删。shim 改用 `_tag_args` 包裹。
5. **两点定弧到不了终点**：上游 `ArcBetweenPoints` / `CurvedArrow` 同一段坏公式抄两遍——法线取反了、扫角没取反 → 弧绕 180° 落不到终点（仅 `|angle|=π` 碰巧对）。适配层改用 `Arc` 按 `arcBetweenPoints()` 算对的圆心/半径/起始角/带符号扫角重造（`ARC_SHAPE_REPAIRS`）。
6. **`TransformMatchingTex` 只剩配对片段**：上游把没配上对的复制品挂到 `source.parent`，顶层物体 parent 是 null → 复制品没人收，`x = y` 只剩 `=`。补 `adoptOrphanFadeIns()`：play 回来把 `_fadeInParts` 里的孤儿收养进场景。
7. **`set_stroke(color=…)` 数据对了画面不变**：渲染层描边材质读的是 `_color`，`_style.strokeColor` 只是回读通道——第五轮的修法写对了回读、没写进渲染。现在颜色写两处（`_color` + `strokeColor`），填充通道照旧不碰。
8. **`Matrix` 只剩一对括号**：上游 `_buildMatrix` 把同一批条目**先后 add 进行和列**，而 `Mobject.add` 是单亲的——列把条目偷走、列组又从没挂上矩阵 → 画面只有括号、内容全空。补 `repairMatrixEntries()`：构造后把条目还回行里，并顺手把每个条目（内部是光栅化的 `MathTexImage`，**异步**出纹理）登记进既有的渲染等待，play 不再抢在纹理落地前开始。
9. **`Angle` 三点定角画成优弧**：45° 的夹角画出 315° 的近整圆——上游把参考轴强行翻成 z>0，翻了轴没翻测量方向，顺时针角量成 `2π−θ`。补 `angleFromPoints()`：自己算起始角与带符号扫角（默认取不越过 π 的那侧，`other_angle` 要优弧保持方向绕远圈），桥侧用 `Arc` 重造（`ANGLE_POINTS_REBUILT`）。

复核结论（23 条「疑似空白」逐条对过图）：22 条是**合法终态**——单个点本来就小（墨迹 0.02%）、结尾就是 `FadeOut` / `remove` 的、`ValueTracker` / 场景家族这类**本来就不画东西**的——已确认不是 bug。**已知上游依赖**：manim-web 的 LaTeX 光栅化（`MathTexImage`，`Matrix` 条目内部用它）靠 KaTeX CSS 布局，其 CSS 从 jsdelivr CDN 拉——插件已在页面注入随包的本地 `assets/katex/katex.min.css`（`client/index.tsx`），**断网时矩阵条目会退化**（SVG 版 `MathTex` 不受影响，走随包 MathJax）。截图脚本里把该 CDN 地址映射到了本地同一份，保证离线截图与真机一致。

### 第七轮：两条真机轨迹——播放规则会「翻面」、同一个 MathTex 连 morph 两次会炸

两条都来自真实会话轨迹，也都不是「某一行写错了」，而是**采样时机**与**上游记账**两个层面的问题。

**(a) 播放规则翻面。** 用户原话：「刚刚渲染的时候，它直接用了 fast。后面过来时，它用慢慢播放，后面又用了 fast。」同一张卡在三种待遇之间来回跳，而**所有单测都是绿的**——因为 `decidePlay` 本身没错，错的是喂给它的 `live` 在**反复重放**里会翻面。定位手段是把真实事件流灌进宿主的**真** conversation assembler：同一张卡上 `start()` 跑了 5 次，最后一次 `turn.status` 从 `open` 翻成 `closed`；`assembler.ts` 里那句「调 `start()` 之前 `context.state = undefined`」是这次的关键线索——它堵死了「靠上次结果记」这条路，只能自己记。修法两条：`definition.ts` 的 `bornLive` **只加不减**（见过一次 `open` 就永久成立），`card.tsx` 把记账从「画布立起来之后」提前到「决定那一刻」（`spent`）。细节与用户口径见上节「聊天卡片」第 2 条。

**(b) `alignVmobjectPair` 报的不是点数，是记账。** 第二张卡报 `第 6 行：pyodide.ffi.JsException: Error: alignVmobjectPair(source): subpath lengths sum (74) does not match point count (72)`。这类错误在 Node 里**一条都复现不出来**（`headless.test.ts` / `upstream-fixes.test.ts` 里同样的 morph 全绿——KaTeX 在 Node 里不走同一条 SVG 路径，坏不掉那套记账），所以先搭了一台**真渲染**复现台（真 Pyodide + 真 manim-web browser 构建 + 真 WebGL + 真 KaTeX），把那张卡的源码原样跑，**一字不差复现出同一条报错**；再按行二分到第 38 行 `play(Transform(coarse, fine))`，最后用最小对照锁定元凶：**同一个 `MathTex` 被连续 morph 两次**（`Transform(n4,n8)` 后紧跟 `Transform(n4,n20)`）→ 炸；中间换个物体（`coarse→mid→fine`）或只 morph 一次 → 都通过。

根因是上游的**子路径记账**：`MathTex` 有两套「子路径长度」——`_baseSubpathLengths`（物体自己的结构）与 `_transformSubpathLengths`（morph 期间被改写成**目标**那套），生效值是**后者 ?? 前者**；morph 收尾时未必把点数摆回与记账同一套，两边一对不上，上游 `alignVmobjectPair` 的第一道对账就抛。两处细节值得记：① **坏的是子物不是顶层**——顶层 `VGroup` 自己压根没有记账（探针只看到 `undefined`），坏的是内部的字形子物，只在顶层查会一路放行；② `VGroup` 对会**跳过 `canMorph` 探针**（那条路认为「按子物配对」必然安全），于是这条路上没有任何一道关拦它——真机上就是这么被骗过去的：预检放行，进去之后才炸。

修法是核心包的 `src/py/subpath-bookkeeping.ts`，两手都要：**跑之前查**（`subpathTreeConsistent` **走子物**拦——对不上就不 morph、退回交叉淡入淡出），**跑完治**（`healSubpathBookkeeping`——先退回物体自己的基准记账；基准也对不上就**两套一起清**，让上游走 `alignPoints` 兜底。只清基准不够：生效值的 `??` 左边还挂着）。**不能只躲不治**：坏物体还留在场景里，渲染时算子路径朝向用的是同一份记账，照样会抛。回归网分两层：`subpath-bookkeeping.test.ts` 钉**判据本身**（什么时候算对不上、什么时候该治、治完必须自洽），真机验收靠那台真浏览器复现台（最小对照 `w2` 与第二张卡原文都从报错变成正常出画面）。

### 第八轮：滚出屏幕又重播——从「拆画布」到一份渲染调度器

用户原话：「只要滚出屏幕，等一下它又会重新播一遍。我们应该更提前一点，尽量不要让用户看到播放的过程。」以及「播放完后就停在最后那里，不要每次出屏幕又把它销毁。这样一滚动，它又得重新播放，看起来特别奇怪。」

查下来是三件事叠在一起，而且**第一件是我自己对宿主的一个错误假设**：

1. **「滚出即卸载」是个错前提**。插件里一直写着「聊天流是虚拟滚动的、滚出视口就卸载」，于是「拆画布」看起来像在跟随宿主的行为。实际宿主的 `ChatNodeList` 是 `entries.map(...)` 全量渲染，宿主文档也明写 "The transcript itself remains fully mounted"——被虚拟化的是右侧那条 Turn 导航条，不是正文。**行一直挂着，拆画布从头到尾都是插件自己干的**。
2. **`cancelled` 的退还会把机会补回来**。第七轮为了「排着队、压根没轮到就作废 ⇒ 用户什么都没看到」而把 `spent` 退回去；可全页一条解释器队列意味着「滚出去那一刻，这一趟多半还排着队」——作废 → 退回 → 滚回来又真播。这条例外正是用户看到的「一滚动就重播」。
3. **没有预热、也没有上限**。原口径是「进视口才渲染」，用户于是**盯着骨架屏等**；而简单地改成「滚出也不拆」又不行——一张卡一块 WebGL 上下文，滚过几十张会撞上浏览器的活跃上下文上限（一般 16），超了强制丢最老的、那块画布直接变黑。

于是拆出**一份全页共用的渲染调度器**（`src/client/render-queue.ts`），把「谁该跑 / 谁先跑 / 画布攒到几张该收」从单张卡里拿出来（这三件事各自都需要跨卡的信息，单张卡判不了）。六条改动：

| # | 改动 | 落在哪 |
|---|---|---|
| 1 | 去掉 `cancelled` 的记账退还——**只要发过车就不再补** | `card.tsx` 的 `run` |
| 2 | **滚出视口不拆**；画布只在卸载、或活跃数超过 **8** 时被淘汰（收离阅读位置最远的） | `card.tsx` 的 `IntersectionObserver` + `render-queue.ts` 的 `enforceCap` |
| 3 | **预热窗口 6 张**：以第一张可见的卡为阅读位置、向上下交替扩散；优先级 = 可见 → 本批代表 → 近的 → 新的 | `render-queue.ts` 的 `windowIds` / `byPriority` |
| 4 | **极速路径盖块状骨架屏**（不带文字）：挡住那串 0 时长的中间态频闪 | `card.tsx` 的 JSX + `styles.css` |
| 5 | 按钮改叫**「手动播放」**、图标 ▶ / ⏩（播放中按 ⏩ 直接落终态） | `card.tsx` + `i18n.ts` |
| 6 | **同一个 step 并行发的几张只真播最后那张**（`stepKey` + `isBatchTail`） | `definition.ts` 的 `readBatch` + `render-queue.ts` |

两处设计与预期不同、值得单独记：

- **窗口必须按「位置」算，不能按「还没跑的候选」算**。第一版是按候选算的，一渲染就从候选里掉出去、窗口跟着往外滑，**一路把整条会话全预热了**——单测里一眼看出来（本该 6 张，实际 9 张还停不下来）。所以 `windowIds(reading)` 只看下标，与跑没跑过无关。摊法是交替向上向下（0、上1、下1、上2、下2…）、越界就跳过，于是贴底时自然全往上扩散、贴顶时全往下扩散、在中间就上下平均，正好是用户要的形状。
- **`release()` 必须明说「手里还剩没剩画布」**。跑的过程中用户可能按了 ⏩，那一趟被当场作废、画布也收了；若仍按「有画布」记账，这张卡就再也不排队了——台上留一块空白加骨架屏，按什么都没反应。这个坑在写单测的假卡时还踩到一次（`release()` 少传一个参数、`undefined` 静悄悄被当成「没有」），所以假卡里加了一道 —— 忘了传参当场抛错，别让它在断言里慢慢猜。

判据全部抽成纯逻辑、时钟与定时器可注入，由 `render-queue.test.ts`（21 条）与 `card.rules.test.ts`（10 条）钉住——这种东西靠「上下滚半天看看」是验不出来的。**手动播放压过全部自动规则**（包括「同批只播一张」）也是这轮钉的一条：拿批次规则把用户按下的键按回去，等于按了个寂寞（非代表那张按下去只会跳到终态）。

### 设置页：本机环境与包缓存

设置面板里的「Manim 渲染」（宿主 slot `settings.section`）有两张卡片，回答两件以后会越来越要紧的事：**「导出」要靠本机真的 Manim**，而**离线可用性取决于哪些包已经在本地**。

**本机环境**逐项探测 `python3` / `manim` / manim 模块 / `ffmpeg` / `latex` / `dvisvgm`，每项给出 ok / 缺失 / 出错三态。**页面只留数据**：卡片头部是「标题 + 状态行（几项就绪）+ 重新检测」，一行 = 名字 + ⓘ + 状态点与版本，「为什么在意它、找到哪儿了、实际跑的命令」全部收进 ⓘ（悬浮/键盘聚焦才出现）——导出走的是本机，不走 Pyodide，所以「能不能导出」与本机装了什么直接相关，但这层解释不必铺在页面上。两个实现细节：

- 走 `execFile`（不经 shell、参数写死），**自己补齐 PATH**——桌面端宿主拿到的是被裁剪过的 PATH，`/usr/local/bin` 这类常常不在里面，不补的话会「装了却说没装」。补的目录与顺序都收在 `src/host/environment.js` 一处（含 `/Library/TeX/texbin`：它还承担着给 manim 的子进程递 `latex` / `dvisvgm` 的职责）。
- **用户点开才跑**，逐项串行、每项各有超时（`manim` 20 秒、`import manim` 30 秒），不是启动时偷偷扫一遍机器。
- 「manim 库」那项**跟着 manim 命令找解释器**，不问 PATH 第一个的 `python3`：命令是软链进某个 venv 的（`~/.local/bin/manim → ~/.venvs/manim/bin/manim`）时，`python3 -c "import manim"` 问的是另一个 Python，必然误报「未安装」；先 realpath 解开软链、取同层的 `bin/python3`，问的才是装了它的那个（`pythonBesideExecutable`）。

**包缓存**只列**常用**的那十一个（numpy / sympy / mpmath / matplotlib / pandas / scipy / scikit-learn / statsmodels / networkx / pillow / opencv-python），且**行高压到 34px 一档**——环境那几项是重点（44px），库只是备料，轻重在行高上就分开了。**每行是「状态点 + 名字 + 大小 + 一个文字键」**——点在最前面报「在不在本机」（绿实心=已缓存、灰实心=内置、空心环=还没缓存），中间一列是本机占用（右贴、等宽数字；不在本机的给破折号——显示 0 B 会像「占了 0 字节」），键有话直说不让人猜：没缓存的给「缓存」（连依赖一起取）、已缓存的给「删除」（这里清掉，下次用到会重新联网缓存一次）、随包自带的「内置」（禁用键，只为跟旁边那列对齐）。用词一律「缓存」不用「下载」——这些包本来就是运行时联网取的，这里做的是「提前存到本机」，跟「之后断网也能用」是同一件事。清单不是白名单：下面一张**「缓存其他库」卡片**（头部标题 + 一行短说明，输入框与按钮在卡片身体里），写上任意包名就能取（名字按 Pyodide 目录里的包名，也按归一化对写法——`Pillow`、`scikit_learn` 都认；输入时给**补全虚影**，按 Tab 或 → 采纳），取过的手输包会留在清单里，于是「取回来了、想再清掉」在同一条路径上闭环。清单控制在十个出头，是因为 lock 里近三百条、绝大多数人一辈子用不到——要全量的筛选，不如直接写名字快。缓存目录的完整路径不在页面上摆（实现细节，想知道在哪儿看下文路由表与 Host 侧代码即可）。

**包名这件事比看上去复杂**（这轮的第二个真问题）：lock 里包名**三种写法在混用**——键 `pillow` 而条目内的 `name` 字段是 `Pillow`（351 条里 21 条如此：`jinja2`/`Jinja2`、`markupsafe`/`MarkupSafe`…），而 `depends` 里两种写法都出现（`pillow` 用键的写法、`astropy_iers_data` / `ruamel.yaml` 用 `name` 字段的下划线 / 点号写法）。实测 374 条依赖引用：只按**键**解析落空 8 条、只按 `name` 字段解析落空 11 条（含 `pillow`——也就是「提前缓存 matplotlib」会把 pillow 漏掉，而 pillow 正是 matplotlib 的依赖）。所以「选哪一边当名字」都是错的，正解是**归一化之后再比**（`canonicalPackageName`，PEP 503 那套：`[-_.]+` 折成 `-`、转小写），归一化之后 374 条一条不漏，顺带让用户按自己记得的名字打字也能落到同一个包上。这条规则**一处定义、两端共用**（`src/core/py/pkg-names.ts`：Host 侧从 `core.js` 取、浏览器侧直接 import），并配了对着 lock 真实分歧的用例——三个数字（8 / 11 / 0）就是它的账。

两条契约值得单独记住：

- **面板是个可拆的组件**：`ManimSettingsPage` 只收一个 `t`（文案函数）——不读设置面板的 store、不假设自己在哪、不留「关闭」回调。注册只有一行（`client/index.tsx` 里的 `slots.register('settings.section', …)`），以后要把它搬进「学习工作台」那类聚合页，改的就是那一行，面板本身不动。
- **视觉照抄宿主**：卡片 / 细分隔线 / 状态点 / ⓘ / 输入框都按 `dsh-design-system` 的配方、只用 `--dsw-alias-*` 变量手写（不许 import 宿主的 UI 包），浅色深色两套都成立。版式按宿主「存储」「审计中心」那类页的范式：**外面只留一个分组标签，标题、一行说明与动作键都进卡片头部**（动作是描边的文字键，不用挤在一起的小图标）；清单行内的动作是矮一档的文字键。改动版式后用 `_tmp/selfcheck/`（真组件 + 宿主真主题，按内容列实际 564px 宽）截亮暗两色核对、量行高与头部几何，不靠目测猜。

Host 侧对应五条新路由，全都挂在 `/dsh-plugins/manim-live/` 下，成对写在 `src/host/routes.test.ts` 里：

| 路由 | 方法 | 干什么 |
|---|---|---|
| `packages` | GET | 包清单：缓存目录、Pyodide 版本、每包的依赖 / 可 import 名 / 三态 / 字节数 |
| `packages/cache` | POST | 按名字取包（`{ names: [...] }`，一个名字一次请求），sha256 校验后原子落盘 |
| `cache` | POST | 清缓存：体里给 `{ names: [...] }` 就只清这几个（设置页按行清理），不给就清掉缓存目录里全部包（实验场工具条）；都回删掉的文件名，随包件不动 |
| `environment` | GET | 探测计划：有哪些项、每项跑什么命令 |
| `environment/<id>` | GET | 跑一项，回 ok / missing / error 与原因（超时也归 error 并说清） |
| `export/ready` | GET | 导出就绪结论：必要条件（`python3` / `manim` / manim 库 / `ffmpeg`）备齐没有、缺什么；带 30s TTL 缓存——聊天流里几十张卡各问一遍，不能各跑一遍 `manim --version` |
| `export` | POST | 真导出：源码落临时目录 → 本机 manim CLI 渲染（默认 1080p，上限 10 分钟）→ mp4 拷进「下载」→ 回绝对路径；环境没备齐回结构化的 `missing`，不碰渲染 |
| `export/reveal` | POST | 在文件浏览器里定位导出的文件：只认「下载」目录里的路径（解软链后比对），越界拒绝 |

### 导出视频（本机 CLI 真渲染）

卡片头部多一个下载键，回答的是「动画很好，但我要一个**文件**」：把这段源码交给本机装的 manim 命令真渲染一遍，mp4 落到「下载」文件夹。整块能力收在 `src/host/export.js` 一个模块里——`exportReadiness()`（就绪门，带 TTL 缓存）、`exportVideo()`（真导出）、`revealExportedFile()`（在文件浏览器里定位）、`exportRoute()`（HTTP 面）四件事都可直接调用，不经过卡片也不经过 HTTP，后期对外提供导出服务就以这一层为界。要点：

- **按钮亮不亮只看环境必要条件**（Python / manim / manim 库 / FFmpeg）。没备齐就置灰，悬停提示列缺什么（用设置页同款的可读名，不甩 id）；LaTeX / dvisvgm 刻意不在必要条件里——只有 MathTex 写法才用得到，普通动画缺它们照样出片。
- **源码不进命令行**：场景名从源码里认（`class X(Scene)`，含 ThreeDScene 等子类；只写 construct 体的包上标准外壳），源码落临时文件、参数写死走 `execFile`，与探测同一套纪律。
- **渲染失败要带回 manim 自己的话**：非零退出取 stderr 最后几行，不许只回一句「失败」；跑完没有 mp4（比如场景里一个 `play` 都没有，manim 只存 PNG）也如实回「没有产出视频文件」。
- **拿成片，不拿碎片**（这轮的真 bug）：开着缓存（默认）时，manim 会把**每一段动画**的小 mp4 留在成片旁边的 `partial_movie_files/` 里，成片才是同一层那个 `<场景名>.mp4`。曾经的挑选逻辑是「按路径排序取最后一个」——而 `partial_…`（小写 p）排在 `SecantToTangent.mp4`（大写 S）之后，于是导出的是一段**一秒的碎片**，用户看到的是「动画不完整」。现在的口径：碎片目录整个排除，优先取名字等于场景名的那份，认不出才退回「取最大」（manim 的正片永远比任何单段碎片大）；只剩碎片没拼成片则如实报错，绝不拿碎片充数。
- 渲染完临时目录整个删掉，只把 mp4 拷走（暂存根可注入，测试才能确定地断言清理）。单元测试用**假 manim 脚本**钉住每一层（落盘、拷贝、**碎片与成片同时存在时取成片**、清理、失败带回报错）；真 manim 的端到端拆进 `MANIM_EXPORT=1` 档（替身 HOME 挡住真「下载」，产物落在临时目录里验收完即删）。
- **导出成功的路径本身就是入口**：悬浮出「在文件夹中显示」的气泡，点击由 Host 调系统文件浏览器选中该文件（macOS `open -R` / Windows `explorer /select,` / Linux 开所在目录）。旁边不放「复制 / 打开文件夹」的图标键——那是同一个动作的第三、第四个说法，悬停已经说清楚了。这个动作会代替用户去操作系统，而路径是从页面来的，所以 Host **只认导出目录里的文件**（软链解掉再比，越界一律拒绝、一条命令都不跑）——通路收窄到「自己刚导出的那份」。
- **导出记录要持久**：卡片会随切会话 / 刷新页面被卸载重挂（滚出视口已经不再拆了，见下），组件里的状态活不过那一趟。所以导出成功后把 `{ callId → 文件路径 }` 记进 localStorage（上限 50 条，时间戳**单调递增**——同一毫秒连写多条时「谁更新」才有确定答案，否则「保留最近 50 条」会间歇性裁错）。挂载时捡回来先只当线索：顺手问一下 Host 文件还在不在（`checkOnly`，不跑任何系统命令），不在了就把那条回执降级成「上次导出的文件已经不在了」——拿一条早已失效的路径当真，比不显示更糟。
- **这次调用被中断了，要认出来**：回合被停止时，已派发的调用回 `Error: tool call aborted`、同一步还没派发的由 `appendSkippedToolCall` 事后补一条 `aborted before dispatch`——**一次取消产生两条 abort**，不是中断了两次（曾据此误判成「用户按了停止」，穷举后确认全仓发 `kind:'user'` 只有 UI 停止按钮 / Esc Esc、goal 暂停、归档带 `stopActivity`、ACP cancel 四个出口）。判定用「`message.isError === true` 且回执不是我们自己的 JSON」——我们自己的失败回执也是 `isError`，但里面带 `ok:false`，靠这个把它们分开（`definition.ts` 的 `readInterrupted`）。认出来之后卡片**不替你自动渲染**（代码本身是完整的，没人验证过而已），底栏出一条警告说明情况，想看点「手动播放」。
- **自动播一次，且只播第一次**（`decidePlay` 是纯函数、单测直接钉）：一条会话里连着好几张卡时，若每张挂载都真播一遍，用户要等的内容是「最后一张」，前面的全是白等。于是「刚生成的那张」正常播一遍，之后**任何一次重挂载都极速落末帧**；老会话（回合早已关闭）里的卡一律不播，直接出终态画面。
  - **「刚生成」不能现算，只能记住**（第七轮的真 bug）：`live` 一开始是拿 `location.turn.status === 'open'` 当场读的，看似「不需要拿时钟去猜」，实则**这个位置会被反复重放**——流式期间每次事件都折一遍，回合结束后还有一次，而最后那一次 `turn.status` 已经翻成 `closed`。于是同一张卡的 `live` 从真变假，用户看到的正是「先极速、再慢播、又极速」这种翻来覆去，而所有单测都是绿的（`decidePlay` 本身没错，错的是喂进去的输入）。引擎又在调 `start()` 之前把 `context.state` 清空（`assembler.ts`），借不到上一次的结果——所以判定归 `definition.ts` 的模块级 `bornLive`：**见过一次 `open` 就永久成立**，只加不减。老会话整窗重折时那一轮早已 `closed`，一张都记不上，「老会话不播」由构造保证、不靠额外分支。
  - **机会用掉就是用了**：`card.tsx` 的 `spent` 记的不是「播完了」而是「决定播了」——**决定即记账**，写在造画布之前。否则「进视口 → 立刻滚出 → 再滚回来」这条路上，同一张卡会前一次来不及播、后一次却能播；反过来也会出现「播一半被打断、回来直接跳末帧」，同一张卡两种待遇。用户口径明确：**播到一半被打断也算它播过了**，不补。第七轮曾留了一个例外——「排在队列里、压根没轮到就被拆了」（`cancelled`）就把机会还回去，理由是「一个字都没跑、用户什么都没看到」。单看这一条它很讲道理，**合起来正是第八轮用户报的「滚出屏幕、等一下又从头演一遍」**：全页一条队列，滚出去时这一趟多半还排着队 → 作废 → 机会退回 → 滚回来又真播。所以撤掉：**只要发过车就不再补**。
- **阅读位置决定谁跑**（第八轮）：`IntersectionObserver` 只**报**可见性（`rootMargin: '240px'`），不再决定生死；「谁该跑、谁先跑、画布攒到几张该收」全交给全页一份的**渲染调度器**（`render-queue.ts`）：以**第一张可见的卡**为阅读位置，向上下交替扩散凑够 **6 张**（贴底就全往上、贴顶就全往下、在中间就上下平均）——这 6 张加上所有可见的才有资格跑，其余**推迟到用户滚过去**，谁也不白烧算力，也不会让人看到离得远的动画在旁边演。优先级：可见的绝对优先 → 本批代表 → 离阅读位置近的 → 同距离新的先（聊天跟随尾部，新卡一出现就是最近的那张，所以「刚生成」不必再单独占一档）。一次只发一个许可（全页只有一份解释器，本来就串行），拿到许可的卡跑完必须 `release()`；`release` 还要明说「手里还剩没剩画布」——跑的过程中用户可能按了 ⏩，那一趟的画布已经收了，报「有」会让这张卡永远等不到重跑。
- **滚出视口不拆**（第八轮纠正的一条误解）：插件里原来写着「聊天流是虚拟滚动的、滚出即卸载」，**是错的**——宿主的 `ChatNodeList` 是 `entries.map(...)` 全量渲染，宿主文档也明写 "The transcript itself remains fully mounted"（被虚拟化的是右侧那条 Turn 导航条，不是正文）。行一直挂着，于是「拆画布」从头到尾都是插件自伤：滚回来要重跑一遍 Python，屏幕上先空一块、再重画——用户看到的就是「一滚动它又演一遍」。现在滚出视口**不拆**，画布只在两种情况下没：卡片真卸载，或**活跃画布超过 8 张**时被调度器按「离阅读位置最远」收掉（一张卡一块 WebGL 上下文，浏览器活跃上限约 16，超了会强制丢最老的、那块画布直接变黑）。上限比预热窗口的 6 略大，给手动滚动留余量，免得刚滚回来那张立刻被收、又闪一下。顺带一处：正在跑的那次若因淘汰 / 卸载而作废，**不算渲染失败**、不往界面上报错，但机会也不补（见上一条）。`bornLive` 与 `spent` 都是模块级 `Set`（内存、跨挂载、不落 localStorage——刷新页面后再看一遍末帧本来就够）。
- **同一个 step 并行发的几张只真播最后那张**（第八轮）：模型会在同一个 step 里并行发好几个 `manim_render`（真实轨迹里见过 3 个，形如 `call_00_` / `call_01_` / `call_02_`）。一个 step 只真播一张——用户等的其实是结果，不是 2~3 段动画接连演完（那要 6~9 秒，后几张全程骨架屏）。判据用宿主现成的粒度：`location` 上的 `turn` + `step` 合成 `stepKey`（形如 `1:2`，`definition.ts` 的 `readBatch`），调度器的 `isBatchTail` 取同批里 `seq` 最大的那张当**代表**、只让它真播。取最后一张而不是第一张，与上一条同一个道理：让离视线最近的那张负责。认不出 step 时**每张各算一批**（键带 `callId`）——落回同一个空串会让这批「认不出」的卡挤成一批、只播一张，等于凭一次采样失败把几张卡的动画吃掉；宁可多播一张，不能少播。同批最后一张还没登记完就先别发车（120ms 静默期），否则早到的那张会抢在兄弟卡挂载之前开跑、多播一段。
- **按钮叫「手动播放」，两个图标**：没在播时是 ▶（`Play`），**一定真播**——压过「只播一次」「老会话不播」「同批只播一张」「实验场极速档」全部自动规则（拿批次规则把用户按下的键按回去，等于按了个寂寞：非代表那张按下去只会跳到终态）。正在播时变成 ⏩（`FastForward`），按下去**不演了、直接落终态**（两种模式共用一个键，所以 ⏩ 也压过手动）。中断卡上这个键同样管用：那类卡先前压根没渲染，按下前会先把渲染 effect 叫起来（`attempts` 计数）。
- **极速档要盖骨架屏**（第八轮）：`fast` 只是把动画时长压到 0，**每个 `play` 仍然逐个走一遍、各画一帧**——0 时长下就是一串中间态频闪，虽然很快但看着很难受。所以「想渲染、还没画好、而且不是在真播」的那段盖一层**块状骨架屏**（`styles.css` 的 `.mr-canvas-skeleton`）：排队等许可、以及极速重跑那一段都被它盖住，只剩「骨架 → 终态」。**不能带文字**——这会儿是「动画在跑」，不是「在下载什么」，写「正在加载」会跟取包那条提示撞车（那条才是真在取东西）。
- **状态统一收在底部状态栏**（`FootRow`，四种音色：成功绿勾 / 报错红叉 / 进行中转圈 / **中断三角警告**）：顶栏是「这张卡是什么」——标签与动作键，高度要稳；「现在怎么样了」是随时在变的一层，压在顶栏会把标签挤掉。于是**渲染成功不出条**（画面本身就是回执），只有渲染失败（叉号 + manim 的原话）、预检失败、**这次调用被中断**、导出进行中/成功/失败才在底部出一条，同在时上下多行。卡片的明暗两套与几何（顶栏 32px、报错行 20px 起、路径截断不撑破卡片）用 `_tmp/selfcheck/shot.mjs` 的 `#card` 模式量化核对。

## 测试与覆盖率

分两层，别混：

- **语料回归 / 运行时 / 适配层 / 支持面**（**在核心包仓里跑**）：`cd ../manim-live && pnpm test`。当前 **11 文件 / 603 通过 / 15 跳过**。其中语料回归把那批**离线**语料逐条过真管线（真 Pyodide + 真 manim-web；`Scene` 换假画布，只验「收不收、炸不炸」）。**需联网**的那 15 条（`net` 第三方包 / `combo` 多库协同）默认不跑：`MANIM_NET=1 pnpm test:net`（首次会下载几十 MB）。`syntax`（语法综合）与 `api`（API 点名）只用 manim + 随包的 numpy，是离线的，随默认套件跑。
- **插件这一侧**（**在本仓跑**）：`pnpm test`。当前 **12 文件 / 247 通过 / 2 跳过**。覆盖 Host 工具 / 技能注册 / 各条路由 / 包清单 / 环境探测 / 导出 / 客户端逻辑（卡片播放判定、渲染调度器、落盘校验）。客户端 **UI 不写测试**。
- **Vitest 逻辑覆盖率**（覆盖「代码」）：两侧各有 `pnpm coverage`。**不测 UI**（`.tsx` 与浏览器渲染胶水不计入分母），只要求**逻辑（非 `.tsx`）语句覆盖 ≥ 80%**。UI 改动以真机看几何为准，不写类名 / DOM 形态测试。

小费：`coverage` 每次要清自己上一轮的 `coverage/` 输出，本机的安全删除拦截会挡下来，前缀 `CODEBUDDY_SAFE_DELETE_ENABLED=0` 即可（只影响 vitest 的产物目录）。清除「按需取」的三方包缓存不必手删——实验场工具条有「清除缓存」，走 Host 的 `clear-cache` 路由，删的是 `~/.dsh/cache/manim-live/pyodide/` 里按需下载的那部分（随包件不在其中）。

## 结构

```
index.js                  Host 侧入口；只 re-export src/host/index.js
client.js                 Client 构建产物（随包提交）
cordis.patch.yml          把插件插进 profile 的 patch（条目的 id 与入口路径都是 manim-live）
tsdown.config.ts          构建声明：只有 client.js 一个产物（Host 半边是免构建 JS）
tsdown.preset.ts          tsdown 客户端预设（每包自带一份，与 dsh-plugin-template 逐字节相同）
tsconfig.json             类型检查（覆盖 src/）
assets/katex/             KaTeX 样式与字体（MathTex 渲染用，由 Host 路由提供）
assets/pyodide/           Pyodide 发行版随包：核心（asm.js/wasm + stdlib.zip）+ 随包 wheel（numpy / sympy / mpmath）+ 包目录 pyodide-lock.json
scripts/gen-skill.mjs     技能文档清单段生成器（跨仓读核心包的语料与三态表）
skills/manim-live/        AI 面向的技能：可用 API 清单 + manim-web 缺失项与替代 + 场景模板 + 纪律

src/
├── routes.js             全部六条路由的唯一真源（Host 注册与 Client 请求用同一个值）
├── host/                 Host 半边（**免构建的原样 JS**）：manim_render 工具（含干跑预检）+ 技能注册 + 使用指引 + 各条路由
│   ├── index.js          apply 组装：把工具 / 技能 / 指引与各条路由挂上去
│   ├── assets.js         静态资源路由（katex：路径边界校验 + MIME 直发）
│   ├── pyodide.js        Pyodide 资源路由（随包件直发，缺的按需回源 + sha256 校验 + 原子落盘）、包清单与预缓存、清缓存
│   ├── environment.js    本机环境探测（python3 / manim / manim 模块 / ffmpeg / latex / dvisvgm）
│   ├── export.js         导出视频：本机 manim CLI 真渲染 mp4（就绪结论 + 真渲染 + 在文件浏览器里定位）
│   ├── http.js           路由共用的小工具：sendJson / readJsonBody
│   └── routes.test.ts    路由测试（含 405 / 404 / 坏正文 / sha256 不符 / 取包失败即停）
└── client/               浏览器半边（打包进 client.js）
    ├── index.tsx         入口：locale / 样式接线 + 对外服务 + slot 注册（导航项 / 整页 / 聊天卡片 / 设置面板一节）
    ├── service.ts        对外服务 `manim`：核心包 `createManimRenderer` 的薄封装 + 模块级单例（卸载时 dispose）
    ├── definition.ts     聊天卡片的会话折叠定义（tool/call → 卡片节点；顺带读 `live`＝这张卡刚生成出来的、`interrupted`＝这次调用被中断、`stepKey`/`seq`＝这张卡属于哪一批（同一个 step））
    ├── render-queue.ts   渲染调度器（全页一份）：阅读位置 + 6 张预热窗口 / 优先级 / 画布上限 8 张 / 同一批只由代表播
    ├── components/       卡片与页面零件：card.tsx（画布 + 手动播放 ⏯ + 查看代码，聊天与实验场共用）、code-view.tsx、segmented.tsx、tip.tsx
    ├── page.tsx          实验场：样例 / 自定义代码两种模式（分段切换），左栏清单 + 工具条，右栏预览
    ├── samples.ts        实验场的内置样例集（python 逐字取自核心包仓的语料文件）
    ├── settings.tsx      设置面板「Manim 渲染」一节：本机环境 + 包缓存（可拆的纯组件，只收 `t`）
    ├── packages.ts       包清单 / 依赖闭包 / 取包 / 清缓存（设置页与实验场共用这一层）
    ├── environment.ts    本机环境探测的取数与响应解析
    ├── export.ts         导出视频的取数与响应解析
    ├── storage.ts        实验场状态落盘（结果 / 极速开关 / 代码 / 模式 + 导出记录），读时逐字段校验
    ├── clipboard.ts      剪贴板（clipboard API + execCommand 兜底）与「已复制」反馈
    ├── code-highlight.ts shiki 高亮（自装，颜色走宿主 --shiki-* 变量）
    ├── navicon.tsx       导航图标
    ├── i18n.ts           文案与命名空间
    └── styles.css        皮肤（只引 --dsw-* token）
```

**运行时 / 适配层 / 渲染引擎 / 语料 / 支持面都不在本仓**——它们在核心包 `manim-live`（`src/py/` 运行时链、`src/engine/` 渲染机制、`src/testbench/` 测试台逻辑、`corpus/` 语料与截图）。本仓只剩两件事：**DSH 侧的接线（`src/host/`）+ 本插件自己的 UI（`src/client/`）**，外加一份 `src/routes.js`（六条路由地址的唯一真源）。这是 Phase 1 抽包的结论，见 `_docs/工作文档/manim-live/2026-10-10-01-抽出核心包/`。

**注意 `src/host/**` 是免构建的原样 JS**：改它不用 `pnpm build`，宿主的热重载直接生效；只有 `src/client/**` 要打包成 `client.js`。

## 运行时

核心包 `manim-live` 的 `src/py/` 是这套东西的核心：**用真 Python（[Pyodide](https://pyodide.org/)，CPython 编译成 WASM）执行 AI 写的 Manim Python**，而不是自己手写 Python→JS 转译器、也不是手写 numpy 子集。原因是任何「手写子集」都是撞到才补，语法与库的缺口永远补不完——换成真 CPython 之后，numpy 就是 numpy 本身。链路是三段：

1. Pyodide 执行用户代码；`from manim import *` 加载我们内嵌的 Python 适配层（`manim-shim.ts`）。
2. 适配层里每个图形 / 动画 / 方法调用，都转发到若干 `_mb_*` 内置函数。
3. 这些内置函数调 `ManimBridge` 接口——浏览器里接**真桥**（落到 manim-web 对象），Host 预检时接**空桥**（只做缺失项检查）。

> 本节提到的 `runtime.ts` / `manim-shim.ts` / `manim-bridge.ts` / `dry-run-bridge.ts` / `subpath-bookkeeping.ts` / `surface.ts` 都在**核心包 `manim-live` 的 `src/py/`**（`renderer.ts`、`canvas.ts`、`library.ts` 在 `src/engine/`）——Phase 1 抽包时整块搬走，本仓一行不留。

一处与 Skulpt 的关键差异：CPython 没法在同步函数中途让出控制权去等渲染完成，所以 `construct` 会被 `ast` 改写成 `async def`、其中的 `play` / `wait` 补上 `await`（不是正则替换，走真语法树），再由 `runPythonAsync` 的顶层 `await` 驱动。因此**每个 `Scene.play()` 都是等一下播完才往下走**，与标准 Manim 的直觉一致。

**全页只有一份解释器，所以必须串行**：整页共用一份 Pyodide 实例、一个 `manim` 模块，桥与源码也写在同一个全局 `_dsh_bridge` / `_dsh_src` 上——Python 侧 `_mb_play` / `_mb_create` 每次调用都是**现取**这些全局。而上面那个 `await` 正是让出解释器的时刻：两张卡同屏时，B 卡完全可以在 A 卡两次 `play` 之间挤进来改写全局，于是 A 卡后半段动作打到 B 的桥与句柄表上，当场报「未知的对象句柄」，画面上两块内容挤在一起、看起来「有一张没渲染」。曾经这个 bug 的真实形状是**卡 A 的两次播放全都落到 B 上、A 一次都没收到**（把队列临时去掉，`runtime.test.ts` 的并发用例立刻复现出 `['B:play','B:play']`）。所以 `runPython` 入口即排队（`runtime.ts` 的 `enqueue`），队内一次只跑一个；`renderer.ts` 把作废映射成 `cancelled` 而非失败——**作废判定放在拿到队位之后**：排队期间画布被拆掉（被调度器按上限淘汰、组件卸载、用户按了 ⏩ / 手动播放打断）那一份整段丢弃、不硬跑一次必然失败的渲染，也照样让出队位不挡后面的人。第八轮起「谁先拿到队位」由 `render-queue.ts` 决定，这里仍是最后一道串行闸门。

Pyodide 与随包 wheel 放在 `assets/pyodide/`：Client 走 Host 的 prefix 资源路由，Host 侧预检直接从文件系统动态 import——**随包件两端都不依赖外网**。**随包的是 `numpy` 与 `sympy`（连同 `sympy` 的依赖 `mpmath`，三个 wheel 合计约 7 MB）**（Pyodide 侧的 CPython 是 3.12，wheel 形如 `numpy-2.0.2-…-wasm32.whl` / `sympy-1.13.3-py3-none-any.whl`；`runtime.ts` 在 load 完 Pyodide 后 `loadPackage('numpy')`，因为适配层一 import 就要用）。

**其余第三方库按需取**，两层协作：

- **认**：`runPython` 每次执行前先用 Pyodide 的 `loadPackagesFromImports` 扫一遍源码里的 `import`，缺什么取什么（它认得 `from manim import *` 与标准库，不会误取——`manim` 那行每段场景都有，误判会让所有场景卡在取包阶段）。取的进展回调给卡片显示「正在加载 X…」，随包件与缓存命中都不经过这一步，所以不会闪提示。
- **取**：浏览器侧 Pyodide **只从 `indexURL` 读**——源码里 Node 侧缺包会回落官方 CDN，浏览器侧**不会**（实测确认），所以取包的唯一通道就是 Host 那条资源路由。路由按「**随包目录 → 用户缓存目录 → 回源下载**」三级找；前两级都没有，才从 Pyodide 官方发行通道（`cdn.jsdelivr.net/pyodide/v0.27.7/full/`）下载，按 `pyodide-lock.json` 里的 sha256 校验后**原子写进用户缓存目录**（先写 `.part` 再改名，中途失败不留半截文件）。缓存目录是 **`~/.dsh/cache/manim-live/pyodide/`**——跟随宿主的 `dshHomePath`（与附件 `cache/attachments` 同一条规则），磁盘持久、之后离线也命中，用户能看能删；**绝不写进插件目录**（那是随包产物，还可能是软链出去的仓库）。取包失败**不 reject**、只走 errorCallback，所以 `runtime.ts` 把成对的英文行（`The following error occurred while loading scipy:` + 原因）拼成一句人话（含「首次用到需要联网取一次」这层信息）再抛 `PyRuntimeError`。

`assets/pyodide/pyodide-lock.json` 是 Pyodide 的**官方包目录**（351 项）：既是「Pyodide 有哪些包」的清单，也是**回源下载时文件名与 sha256 的唯一依据**——不另写一份包清单，随包件与按需件的校验都从这一处取。要让某个包变成随包件，只需把它的 wheel（及其依赖）放进 `assets/pyodide/`，`loadPackage` 就找得到。

核心包的 `api-map.generated.ts` 由核心包的 `scripts/probe-api.mjs` 对 manim-web 逐项实测生成（事实来源是 manim-web 本身），适配层据此自动生成类 / 动画别名，避免手抄漂移。

## 边界

- 规范见工作区仓 `dsh-plugins` 的 `AGENTS.md`；机制 / 安装 / 验证见技能 `cordis-plugin-development`；视觉见 `dsh-design-system`；踩坑见 `important-thing`。
- 基座模块（React 等）只来自宿主，不要把 react / react-dom 打进产物。
- 独立运行是硬要求：模块表里没有黑板 / 播放内核 / tts 时，仍能提交一段 manim Python 并在聊天流里看到可看、可手动播放的卡片。
- **宿主的行为要读源码，不要凭感觉**：「聊天流滚出即卸载」这个错前提让我把插件自伤当成了跟随宿主的行为，代价是三轮「一滚动就重播」（见第八轮）。第八轮据此顺手纠正了插件里另外两处同一来源的错述。
- **有一类 bug 只在真浏览器里存在**：KaTeX 的字形路径、真 WebGL、真 DOM 缺一不可。第七轮的 `alignVmobjectPair` 记账就是这种（连 `headless.test.ts` 的真场景也验不到——KaTeX 在 Node 里不走同一条 SVG 路径）。这类改动**不能只看 `pnpm test` 绿**：Node 侧钉的是判据，真机验收得走一遍真渲染复现台。
- **验收是三层，越往下越贵**：假画布语料（收没收到、炸不炸）→ 真场景 headless（动画 / updater 到底跑没跑、终态落在哪）→ 真浏览器（画得对不对、上游记账坏没坏）。每层只能拦自己那一类，不要拿上一层的绿去推断下一层。
