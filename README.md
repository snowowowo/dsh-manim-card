# manim-renderer — Manim 渲染

给宿主加一个能力：**AI 在聊天里直接写 Python 的 Manim 代码，当场渲染出画面**。只装这一个插件就能用，不依赖黑板或其他插件。

它把旧黑板里三件事合成一个包：**运行时**（真 Python 解释器执行 AI 写的 Manim Python）、**渲染器**（跑在真 manim-web 上画进画布）、**入口与出口**（Host 工具 + 聊天流卡片）。对外服务 `manim`（供第三方插件消费）已提供：`check(python)` 干跑预检 + `createSurface(container)` 造一块画布。

## 状态

**进行中**：Python 运行时（`src/core/py/`，Pyodide 执行 + manim 适配层 + 桥，自带测试）、渲染引擎（`src/client/engine/`）、KaTeX 与 Pyodide 资源路由、**聊天卡片**（AI 调 `manim_render` → 聊天流出一张卡，进入视口自动渲染、离开视口释放、可重播）、**技能**（`skills/manim-renderer/`，把可用 API、写法边界与**场景模板**讲给模型）与**Host 侧预检**（返回前用空桥干跑一遍，不通过当场回 `error`）都已就位；**随包外的 Python 库按需取**（`import pandas` 这类首次联网取一次、按 sha256 校验后落进 `~/.dsh/cache/manim-renderer/pyodide/`，之后离线命中，取的期间卡片上提示「正在加载 X…」）也已接线；**设置面板**里的「Manim 渲染」一节（**本机环境探测** + **包缓存清单与预缓存**）也已就位，见下。

写法上除属性动画 `self.play(m.animate.x(...))`（可链的方法由探针实测 manim-web 的 animate 代理生成，不在表里的当场报错并列出可用项）外，`rate_func=` / `run_time=`、`m[i]` 取段、`m.width` 这类属性读取、`self.clear()` 也都已接线——「这个写法支不支持」的判定与真执行取同一份支持面（`src/core/py/surface.ts`），所以**预检放行的，真桥不会当场拒**。**方法改写**（`surface.ts` 的 `METHOD_REWRITES`）负责「CE 有、manim-web 换了形状」的那批：`set_stroke(color=, width=, opacity=)` → 颜色走**属性写**、`_color` 与 `strokeColor` 各写一份（渲染层读前者、回读走后者，见第六轮第 7 条）、宽 / 透明度走专属 setter——**不能**落 `setStyle`：manim-web 的 set color 存取器会把 fillColor 一起冲掉（见第四轮 (b) 的色板事故）；`set_opacity(x)` → stroke + fill 两个 setter、`put_start_and_end_on(a, b)` → Arrow 走同名方法、Line 走 `setStart` + `setEnd`。物体/动画的归类按 manim-web 的**实测原型链**定，不看 CE 把它挂在哪个模块下（CE 把 `TracedPath` / `AnimatedBoundary` 放在 `animation/` 里，两者其实是物体）；「包住一个物体」的写法（`TracedPath(dot)` / `SurroundingRectangle(text)` / `Union(a, b)` …）也走同一份构造规则。`self.add(...)` 收到动画会当场给出可读报错（校验在 Python 侧，预检也拦得住）。左侧导航「Manim 渲染」是**实验场**（见下节），既是肉眼验收台，也是支持面的计量器。

顶层设计见 `_docs/工作文档/2026-10-09-01-manim渲染插件/顶层设计.md`。

### 实验场（语料回归网）

左侧导航「Manim 渲染」那一页是**实验场**：左边语料清单、右边渲染预览，点哪条跑哪条，也可以「全部渲染」按顺序跑完，通过 / 失败当场标在条目上。它不是一个另做的调试页——**画布就是聊天卡片那个组件**（`components/card.tsx`），所以重播 / 查看代码 / 复制这些能力天然一致（页面对卡片只多传了 `autoStart`：一次只挂一张卡，不必再等视口）。

页面顶部是**视图切换**（`components/segmented.tsx`，分段控件）：`语料实验场` 与 `自定义代码`。两者互斥（同一时刻只挂一张卡），所以「自由编辑」不再是常驻在一旁的第二块编辑区。说明性长文案一律收进 `components/tip.tsx`（悬停 / 键盘聚焦才出现），页面上只留控件。

工具条（图标 + 悬浮提示）：**全部渲染**（只跑尚未通过的，已通过的跳过）/ **停止** / **复制结果** / **清除记录** / **极速**。每个分组标题右侧还有一个按钮，只跑**这一组**里尚未通过的语料。

- **进度落盘**：逐条结果、极速开关、自定义代码、当前视图都存 `localStorage`（`storage.ts`），刷新或中途崩了不用从头再来；「清除记录」清空。
- **极速**：不等 `run_time` 与 `wait`，直接落到终态——批量渲染 141 条按真实时间要几分钟，极速下一屏就完事。实现见 `manim-bridge.ts` 的 `fast`：动画时长压到 0（manim-web 对 `duration <= 0` 取 `alpha=1`），`wait` 则把场景里的 updater 按固定步长推到时长之后再渲染一帧——**不能一省了之**，`TracedPath` 这类轨迹本来就是在 `wait` 里长出来的，省掉就是空的。看动画过程时关掉这个开关。
- **通过 / 失败按「预期」判**：`expect: 'reject'` 的那组语料，**跑不通才是通过**（它验的就是「当场拒掉、且说得清」）。红绿点、「通过 N 条」、续跑都走这一个判据。

跑完点「复制结果」，把每条的结果、报错与**所在文件路径**一起带走——拿这份回执就能直接定位到那一个 `.py` 文件。

语料本体是**本仓 `_dev/examples/` 下的完整 Manim 文件**（14 组 / 175 条：离线 160 条 = 120 条应通过 + 40 条应拒绝，其中 1 条标了 `@browser`、Node 套件跳过；另 15 条需联网），独立可跑：

```bash
manim _dev/examples/basic/01-circle.py CircleScene
```

**为什么在包外**：这批文件是开发期的回归网（外加讲解模板的出处），不是产品功能——跟着插件发布，等于让每个用户都背上一个只有开发者才用的实验场，还要把上百条源码打进 `client.js`。所以整条链路没有「语料打包」这一步：Host 侧的语料路由（`src/host/corpus.js`）在**运行时**去读那个目录，正式安装里这条路径不存在，实验场自然退化成「自定义代码」。语料根可用环境变量 `MANIM_CORPUS`（绝对路径）覆盖，解析顺序与「谁在读它」都收在 `src/host/corpus.js` 一处（**不许再有第四处**）。

文件即元数据：docstring 第一行是标题，`@expect <一句话>` 是**预期表现**（页面展示、悬停可见），`@reject <关键词>` 标记「这条应当被当场拒绝」并钉住报错里必须出现的词，`@note` 写出处。目录即分组（目录没在 `corpus.js` 的 `GROUPS` 里登记就报错，免得新加的文件夹被静默漏掉），页面（浏览器）与自动测试（Node）读的是同一批 `.py` 文件，不存在「页面那份和测试那份不一样」。

**`lesson` 组是给模型参考的场景模板，也正是语料**：三角函数线、极坐标、线性变换、割线→切线（导数）、黎曼和（积分）、概率分布这类讲解场景比基础语法长得多、组合也多，让模型从零拼最容易出错——所以把它们预制成一整段完整文件，**先当普通语料在页面里单列一组跑通，全绿了才算过**，再由 `scripts/gen-skill.mjs` 原样内联进技能 `SKILL.md` 的「场景模板」节（`<!-- gen:templates -->`）。模板与语料因此是**同一份文件**：模板之所以「验证通过」，就是因为它本身在回归网里；改模板 = 改语料，验证自动跟上，不存在「技能里那份」和「测的那份」两份。

- **页面**：逐条肉眼验，失败能看到完整报错；
- **自动测试**（`examples.test.ts`）：同一条目跑真管线（真 Pyodide + 真 manim-web），一条失败一条红。

⚠️ **假画布是盲区**：`examples.test.ts` / `manim-bridge.test.ts` 把 `play` / `wait` 换成空函数（只验「收没收、炸不炸」），所以**动画与 updater 到底有没有真的跑，那两份测试验不到**。带 updater 的语料曾在假画布下全绿、在真画布下必炸（见 `important-thing` 的 updater 条目）；**点数对齐型动画**（`Transform` / `ReplacementTransform` / `FadeTransform` / `ClockwiseTransform` …）同样是「假画布看不见」的那种——它们抛在渲染循环里，`play` 的 promise 永不 resolve，页面一直转（见下）。因此另有一份 `headless.test.ts`：用 manim-web 的 `Scene.createHeadless()` 在 Node 里建**真场景**（不碰 DOM / WebGL，但时间线、动画、updater 都是真的），把「单参 lambda 会被补齐、updater 拿到的是 Mobject 包装、**`UpdateFromFunc` / `UpdateFromAlphaFunc` 的回调拿到的也是 Mobject 包装**、极速推的是整段时长、点数对齐型动画在对不齐的一对上不抛（且对得齐的仍真 morph）」逐条钉死。

加一条语料的时机是「AI 写了、我们没接住」——**原文**放进去，不要改成能跑的样子（改好就测不出问题了）。这样「补一次」就变成「钉死一次」，而不是补完即忘。首批 98 条一口气抓出 5 个真问题（构造器位置参数缺登记、`restore` / `weight` / `slant` 改名、`ApplyMatrix` / `ChangeDecimalToValue` 参数形状、`Table` 单元格的句柄没打标），都已在同一轮修掉；随后 updater 的「参数个数 + 参数类型」两个坑也是靠语料抓出来的。

第二轮再补 42 条（**30 条 `reject`** 逐项覆盖三态表里的 `missing` 项 + **12 条 `lesson`** 讲解场景），又从真实轨迹里抓出 4 个：Host 预检用的空跑桥把 `ax.c2p(...)` / `tracker.get_value()` 当句柄返回，于是一段正当的 `(p+q)/2` / `x**2` 算术被误判成「Mobject 不能乘方」——**预检放不放行、与真桥跑不跑得通必须同判**，这次把「有返回值的那些方法各自返回什么形状」在 `surface.ts` 立了一张 `METHOD_RETURNS` 表，两边共用；`from manim import *` 其实带 `np`，适配层只绑了 `_np`；`ThreeDScene` 等场景族在技能里写着可用、适配层却没定义；类壳检测正则只看 `(Scene)`，`class X(ThreeDScene)` 被误当成裸构造体。前两个都先复现出**同一份真实报错**（读会话轨迹 `~/.dsh/sessions/…/session.v4.jsonl.zstd` 解压出模型当时写的代码），再改、再拿语料钉死。

第三轮是**真画布**才看得见的一类：`FadeTransform`（换公式那步）在真机上抛 `alignVmobjectPair: alignPoints fallback produced mismatched point counts (905 vs 589)`。继续挖发现**不是 FadeTransform 一支的问题**——`Transform` / `ReplacementTransform` / `FadeTransform` / `FadeTransformPieces` / `ClockwiseTransform` / `CounterclockwiseTransform` 都会在 `begin()` 里**直接调点数对齐、没有兜底**（实测 `Transform(Arrow, Star)`、`ClockwiseTransform(VGroup(3), VGroup(1))` 都抛）。但它们**不是不可用、而是挑输入**：VGroup 对走「按子物配对」、`Circle → Square` 也能对齐，都正常。所以**不能按名字拉黑，得按实际那一对判**——见下。

修法在支持面立一张 `POINT_MORPH_ANIMATIONS`（登记这一族、并记下「两端是 `VGroup` 时是否就安全」），桥按实际那一对判：`VGroup` 对且这支按子物配对（`Transform` / `ReplacementTransform`）⇒ 直接走真动画；其余情况拿**复制品试跑一次 `begin()`**——对得齐走真动画（保住 morph），对不齐才退到 `AnimationGroup([FadeOut(源), FadeIn(目标)])` 的交叉淡入淡出。判据用 manim-web 自己的 `begin()`，不另写启发式。**复制只对「不发起异步排版」的物体做**：`MathTex` / `Tex` / `Text` 的复制品会各自再排一次版，Node 里必然失败、且是接不住的未处理拒绝（测试全绿但 `pnpm test` 退出码非零）——这类改走保守侧兜底。**这类坑假画布一律验不到**，所以配的是 `headless.test.ts` 的真场景用例：四对「抛过的」（`VGroup(3)→VGroup(1)`、`Arrow→Star`，含 Transform / ReplacementTransform / Clockwise / Counterclockwise 各支）＋**一对「对得齐的」**（`Circle → Square(side_length=4)`，断言宽度真的 morph 到 4，证明没被误退兜底）。

同一条真机代码上还叠着**第二个坑**：`UpdateFromAlphaFunc(result, lambda m, alpha: m.set_opacity(...))` 里的 `m` 是 manim-web 的**裸 JS 对象**。manim-web 这两个类的回调签名就是 `func(mobject, alpha)`（`interpolate` 里 `this._func(this.mobject, alpha)`），裸对象上只有 camelCase 方法，CE 名的 `set_opacity` 当场 `AttributeError`——**与 `add_updater` 是同一个坑的另一个入口**，同样抛在渲染循环里（`headless render loop error ... AttributeError`），循环被停掉、`play` 的 promise 永不 resolve，现象就是「一直转」。修法与 `_register_updater` 同一套：在 `_FUNC_ANIMATIONS`（`UpdateFromFunc` / `UpdateFromAlphaFunc`）里把回调包一层，闭包换成本次动画目标的 `Mobject` 包装，并按回调自己的签名裁参数个数（CE 里 `UpdateFromFunc` 习惯写单参，而 manim-web 固定按双参调）。语料补了 `examples/updater/06-update-from-func.py` 当模板，真场景回归钉了 3 条（`set_opacity` 打得开 / 单参回调收得下 / 与点数对不齐的 morph 叠在一起也跑得完）。顺带记一条**测试环境**的坑：真 headless 场景里构造 `MathTex` 必然产生未处理拒绝（Node 无 DOM，异步排版失败），会让整轮 vitest 退出 1——所以真场景用例里不用文本物体，文本那一对交给假画布语料回归与真机自测。

第四轮分两条线。

**(a) 覆盖面**：原语料一条一行、各点一个写法，长尾太多。补了 `syntax`（只用 manim + 标准库，离线）、`combo`（pandas / scipy / sklearn / statsmodels / matplotlib 多库协同，需联网）与 `api`（**API 点名**）三组。点名不是凑数：把三态表里 `state=ok` 的名字**成批**在真实代码里用一遍（76 个颜色、16 个速率、方法面、几十个形状类、两批动画），名字写错或桥没接上会当场报错，等于给整张可用表加了一层回归网。语料对可用 API 的覆盖因此从 **36.9% 提到 89.4%（337/377）**；剩下 40 个多是「需要外部文件（SVG / 图片）」「需要按类登记构造形状」「回调形状对不上」三类。**第五轮把这 40 个逐个接掉，覆盖率落到 100%（377/377）**——见下节。

**(b) 语料抓到的真问题**（都已修 + 钉死）：

- `VGroup` 遍历**永远不结束**：适配层越界取子物体只把 `None` 原样返回，而 Python 的迭代协议靠 `IndexError` 收尾——`for m in group:` 会一路取下去把内存吃满、整轮 vitest 卡死。修法：`__getitem__` 取不到就抛 `IndexError`，并补 `__iter__`；预检桥 / 记录桥对登记过子物体数的组同判（返 `undefined`）。回归语料 `syntax/06-group-iteration.py`。
- `len(group)` 抛 `TypeError`：manim-web 的 `VGroup` 本来就有 `get length()`，适配层没接。补 `PROP_READS` 的 `length` + `Mobject.__len__`（顺带一处细节：JS 数字过桥是 Python `float`，`__len__` 必须 `int()` 一道），三处桥同判。
- `plot_line_graph(x, y)`：三态表按「方法在不在」记 ok，但 manim-web 收的是**一个选项对象** `{xValues, yValues, …}`，CE 写法会落到不存在的参数上、静默画错——补 `METHOD_REWRITES` 一条。
- `CyclicReplace(a, b, …)`：CE 是变长位置参数、manim-web 收**一个数组**；不包数组时第二个物体被当 options，报错（typia 在它的 `shift` 字段上）完全看不出根因——补 `ANIMATION_ARGS` 一条。
- **回调在前的那一族**（`ApplyFunction` / `Apply*PointwiseFunction` / `ApplyComplexFunction` / `Homotopy` 家族 / `PhaseFlow`）：CE 把回调放**第一位**（`ApplyFunction(func, mobject)`），manim-web 的工厂反过来（`applyFunction(mobject, func)`）。顺序错了**假画布一点看不出来**——动画只构造、不跑到 `begin()`，于是预检与语料回归全绿，真画布一跑就是 `e.children is not iterable`（把回调当成了物体）。补 `ANIMATION_ARGS` 八条换序，并在 `headless.test.ts` 加真场景回归（假画布永远拦不住这一类）。顺带发现 `PhaseFlow` 的回调收**一个**参数（`lambda p: p`），不是 `lambda p, t:`。
- **色板全黑**（第五轮，用户真机肉眼抓的）：`api/01-colors.py` 的 76 个方块渲染成一整片黑。在真物体上探针验证：`set_fill(RED, 1.0)` 后 `fillColor` 是 `#FC6255`（对的），但紧接着的 `set_stroke(width=0, color=BLACK)` 之后**填充也变成了黑**——manim-web 的 set color 存取器一行写两个通道（`this._style.strokeColor = e, this._style.fillColor = e`），而 `setStyle({strokeColor})` 内部正是 `this.color = …`。「只改描边」把填充一起冲掉。修法：`MethodCall` 增加**属性写**形态（`prop: true`，`target[js] = args[0]`），`set_stroke` 的颜色改走 `strokeColor` 属性写；同时补 `PROP_READS` 的 `fill_color` / `stroke_color` / `fill_opacity`——「上了色没有」要能从 Python 里读回来（顺带修了 shim 把 JS 名传给 `getAttr`、查不到表的接线错）。真场景回归两条：链式上色后填充不被冲掉、三个属性读得到真值。**这类「跑通了但画得不对」假画布与断言都拦不住，要靠人眼或截图核对。**

### 预期表现与人工验证（第五轮起）

「跑通」只说明没炸；**画得对不对**是另一回事——色板全黑就是全绿语料里被人眼抓出来的。配套两件事：

- **每条语料带「预期表现」**：docstring 里 `@expect <一句话>`（`src/host/corpus.js` 解析 → `examples.ts` 边界校验 → 实验场预览上方展示）。175 条全部已写。悬停清单条目也能看到。
- **人工验证标注**：预览上方「人工验证」按钮组——看完动画标 **对 ✓ / 不对 ✗**，落 `localStorage`（`storage.ts` 的 `marks`，与自动结果**分开存**）、可单独一键清除；清单条目上显示 ✓ / ✗ 徽标，工具条显示「人工 ✓x ✗y」计数。自动红绿点只管「没炸」，人工标注管「画得对」。

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

**覆盖率结果**：**100%（377/377）**——class 142/142、anim 73/73、method 48/48、scene-method 5/5、const 17/17、color 76/76、rate 16/16。新增语料 4 条：`api/11-classes-extra`、`api/12-anims-extra`、`api/13-svg-browser`、`reject/40-polyhedron`。

**`@browser` 头标记**：`SVGMobject` 要用浏览器的 `DOMParser` 解析整段 SVG 字符串，Node 里没有 DOM。所以加了 `@browser`——Node 套件**跳过它并打印出跳过了谁**（不静默漏跑），这条改由实验场页面（真浏览器）核。`VMobjectFromSVGPath`（只给一条路径 `d`）不需要 DOM，照常进自动测试。

**仍列在已知遗留**：`get_bounding_box()`——manim-web 返回 `{width, height, depth}` 对象，不是 CE 的 2×3 数组；要宽高分别读 `width` / `height`（已登记）。需要外部文件（图片 / 字体）的那几个类同理，等真机代码逼到再补。

### 第六轮：截图自查——「跑通 ≠ 画对」

上面每一轮的教训都是同一句：**语料套件只回答「跑通了没有」，画得对不对它管不着**——颜色被冲掉、终态落在错处、形状造歪，全部跑到最后一行、退出码 0。所以加了一台**相机**：`scripts/shot-corpus.mjs` 用无头 Chromium 加载与卡片**同源**的整条管线（同一个 `core.js`、同一个 `manim-web.browser.js`、同一套画布调用形状），把 124 条可视化语料逐条真渲染、每条落一张 PNG 并量**墨迹占比**（画布上非透明像素的比率，≈0 即整张空白）；`scripts/shot-sheets.py` 再拼成 3×2 对照表，逐条对着 `@expect` 人眼核。跑法：`node scripts/shot-corpus.mjs`（全量离线组）/ `--only <子串>` / `--probe <某个.py>`（打印 print 输出与场景物体清单，调「画得对不对」用）/ `--realtime`（不压速，核动画过程）。产物在工作区仓的 `_tmp/shots/`。

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

### 设置页：本机环境与包缓存

设置面板里的「Manim 渲染」（宿主 slot `settings.section`）有两张卡片，回答两件以后会越来越要紧的事：**「导出」要靠本机真的 Manim**，而**离线可用性取决于哪些包已经在本地**。

**本机环境**逐项探测 `python3` / `manim` / manim 模块（`python3 -c "import manim"`）/ `ffmpeg` / `latex` / `dvisvgm`，每项给出 ok / 缺失 / 出错三态，并配一句「为什么在意它」（导出走的是本机，不走 Pyodide——所以「能不能导出」与本机装了什么直接相关）。两个实现细节：

- 走 `execFile`（不经 shell、参数写死），**自己补齐 PATH**——桌面端宿主拿到的是被裁剪过的 PATH，`/usr/local/bin` 这类常常不在里面，不补的话会「装了却说没装」。补的目录与顺序都收在 `src/host/environment.js` 一处。
- **用户点开才跑**，逐项串行、每项各有超时（`manim` 20 秒、`import manim` 30 秒），不是启动时偷偷扫一遍机器。

**包缓存**列出 `pyodide-lock.json` 里可安装的包（351 项里 wheel / zip 的那部分——`*-tests` 的 `.tar` 装不了、纯 `cpython_module` 不算），每条标出**随包 / 已缓存 / 未缓存**与本机占用字节；顶部可切「本地 / 未缓存 / 全部」、可按名字搜。点某个包上的「提前缓存」会把它的**依赖闭包**一起取下来——闭包**在客户端算**（依赖排在前面，所以中途停下来时已落地的部分是一个自洽的前缀）；卡片里还有缓存目录的完整路径（可复制，也能对着它手动清）。

两条契约值得单独记住：

- **面板是个可拆的组件**：`ManimSettingsPage` 只收一个 `t`（文案函数）——不读设置面板的 store、不假设自己在哪、不留「关闭」回调。注册只有一行（`client/index.tsx` 里的 `slots.register('settings.section', …)`），以后要把它搬进「学习工作台」那类聚合页，改的就是那一行，面板本身不动。
- **视觉照抄宿主**：卡片 / 标签 / 状态点都按 `dsh-design-system` 的配方、只用 `--dsw-alias-*` 变量手写（不许 import 宿主的 UI 包），浅色深色两套都成立。

Host 侧对应五条新路由，全都挂在 `/dsh-plugins/manim-renderer/` 下，成对写在 `src/host/routes.test.ts` 里：

| 路由 | 方法 | 干什么 |
|---|---|---|
| `packages` | GET | 包清单：缓存目录、Pyodide 版本、每包的依赖 / 可 import 名 / 三态 / 字节数 |
| `packages/cache` | POST | 按名字取包（`{ names: [...] }`，一个名字一次请求），sha256 校验后原子落盘 |
| `cache` | POST | 清掉缓存目录里**按需取的**那部分，回删掉的文件名（随包件不动） |
| `environment` | GET | 探测计划：有哪些项、每项跑什么命令 |
| `environment/<id>` | GET | 跑一项，回 ok / missing / error 与原因（超时也归 error 并说清） |

## 测试与覆盖率

分两层，别混：

- **语料回归**（覆盖「API 与场景」）：`pnpm --filter manim-renderer test src/core/py/examples.test.ts` 把实验场那批**离线**语料逐条过真管线（真 Pyodide + 真 manim-web；`Scene` 换假画布，只验「收不收、炸不炸」）。**需联网**的那 15 条（`net` 第三方包 / `combo` 多库协同）默认不跑：`MANIM_NET=1 pnpm --filter manim-renderer test:net`（首次会下载几十 MB）。`syntax`（语法综合）与 `api`（API 点名）只用 manim + 随包的 numpy，是离线的，随默认套件跑。
- **Vitest 逻辑覆盖率**（覆盖「代码」）：`pnpm --filter manim-renderer coverage`。**不测 UI**（`.tsx` 与浏览器渲染胶水不计入分母），只要求**逻辑（非 `.tsx`）语句覆盖 ≥ 80%**——当前实测 **88.4%（1081/1223）**；含 UI 的全部文件是 67.4%。UI 改动以真机看几何为准，不写类名 / DOM 形态测试。

小费：`coverage` 每次要清自己上一轮的 `coverage/` 输出，本机的安全删除拦截会挡下来，前缀 `CODEBUDDY_SAFE_DELETE_ENABLED=0` 即可（只影响 vitest 的产物目录）。清除「按需取」的三方包缓存不必手删——实验场工具条有「清除缓存」，走 Host 的 `clear-cache` 路由，删的是 `~/.dsh/cache/manim-renderer/pyodide/` 里按需下载的那部分（随包件不在其中）。

## 结构

```
index.js                  Host 侧入口；只 re-export src/host/index.js
core.js                   Host 侧运行时产物（tools 返回前干跑预检用）
client.js                 Client 构建产物（随包提交）
cordis.patch.yml          把插件插进 profile 的 patch
tsdown.config.ts          构建声明：两个产物（client.js / core.js）
tsdown.preset.ts          tsdown 客户端预设（每包自带一份，与 dsh-plugin-template 逐字节相同）
tsconfig.json             类型检查（覆盖 src/）
_dev/examples/            实验场语料（开发期回归网，**不进发布集**）
assets/katex/             KaTeX 样式与字体（MathTex 渲染用，由 Host 路由提供）
assets/pyodide/           Pyodide 发行版随包：核心（asm.js/wasm + stdlib.zip）+ 随包 wheel（numpy / sympy / mpmath）+ 包目录 pyodide-lock.json
scripts/                  探针与生成器：probe-api.mjs（三态表）、gen-skill.mjs（把 lesson 模板内联进技能）、test-pyodide.mjs（测试用的 Pyodide 装载器）
skills/manim-renderer/    AI 面向的技能：可用 API 清单 + manim-web 缺失项与替代 + 场景模板 + 纪律

src/
├── host/                 Host 半边：manim_render 工具（含干跑预检）+ 技能注册 + 使用指引 + 资源路由 + Node 侧 Pyodide 加载
│   ├── index.js          apply 组装：把工具 / 技能 / 指引与各条路由挂上去
│   ├── assets.js         静态资源路由（katex：路径边界校验 + MIME 直发）
│   ├── pyodide.js        Pyodide 资源路由（随包件直发，缺的按需回源 + sha256 校验 + 原子落盘）、包清单与预缓存、清缓存
│   ├── environment.js    本机环境探测（python3 / manim / manim 模块 / ffmpeg / latex / dvisvgm）
│   ├── corpus.js         实验场语料读取（包外 `_dev/examples/`；正式安装里是空表）
│   ├── http.js           路由共用的小工具：sendJson / readJsonBody
│   └── routes.test.ts    路由测试（含 405 / 404 / 坏正文 / sha256 不符 / 取包失败即停）
├── client/               浏览器半边（打包进 client.js）
│   ├── index.tsx         入口：locale / 样式接线 + 对外服务 + slot 注册（导航项 / 整页 / 聊天卡片 / **设置面板一节**）
│   ├── service.ts        对外服务 `manim`：check（干跑预检）+ createSurface（一块画布）
│   ├── definition.ts     聊天卡片的会话折叠定义（tool/call → 卡片节点）
│   ├── components/       卡片与页面零件：card.tsx（画布 + 重播 + 查看代码，聊天与实验场共用）、code-view.tsx、segmented.tsx（视图切换，照抄宿主分段控件）、tip.tsx（悬浮提示）
│   ├── page.tsx          实验场：语料实验场 / 自定义代码两个视图（分段切换），左栏清单 + 工具条，右栏预览
│   ├── settings.tsx      设置面板「Manim 渲染」一节：本机环境 + 包缓存（可拆的纯组件，只收 `t`）
│   ├── packages.ts       包清单 / 依赖闭包 / 取包 / 清缓存（设置页与实验场共用这一层）
│   ├── environment.ts    本机环境探测的取数与响应解析
│   ├── storage.ts        实验场状态落盘（结果 / 极速开关 / 代码 / 视图），读时逐字段校验
│   ├── clipboard.ts      剪贴板（clipboard API + execCommand 兜底）与「已复制」反馈
│   ├── code-highlight.ts shiki 高亮（自装，颜色走宿主 --shiki-* 变量）
│   ├── navicon.tsx       导航图标
│   ├── i18n.ts           文案与命名空间
│   ├── styles.css        皮肤（只引 --dsw-* token）
│   └── engine/           渲染引擎：library（懒加载）/ canvas（画布）/ renderer（Surface）/ pyodide（运行时加载）
└── core/                 两侧共享的纯逻辑（不碰 DOM、不碰 Node API）
    ├── index.ts          Host 侧门面（core.js 入口）：只暴露 py/ 的能力
    └── py/               Python 运行时链
        ├── runtime.ts    Pyodide 装载（加载器由两端注入）+ 执行 + 错误归一（PyRuntimeError）
        ├── manim-shim.ts Python 侧 manim 适配层源码（按 api-map 生成别名 / 属性读取 / 下标取段）+ construct 的 async 改写
        ├── bridge.ts     Python 适配层 ↔ 桥实现的契约（ManimBridge / AnimationSpec / 线格式）
        ├── surface.ts    支持面 SSOT：三态表 + 构造规则 + 判定（plan*）——预检与真桥的唯一同源
        ├── manim-bridge.ts  真桥：动作落到真 manim-web 对象（含极速模式：压缩时长 + 推进 updater）
        ├── dry-run-bridge.ts Host 预检用空桥：只查缺失项、不渲染
        ├── examples.ts   语料**接口**（类型 + `parseCorpus` 边界校验）；本体是 `_dev/examples/` 下的 .py，运行时由 Host 路由读取
        ├── examples.test.ts  语料回归：逐条过真管线（离线全跑，联网组见 MANIM_NET）
        └── api-map.generated.ts  探针实测的三态表（ok / alias / missing）
```

三分区是硬约定：新增源码文件必须能归入 host / client / core 之一；`core` 下按能力再分子目录（`py` 是能力名）。

## 运行时

`src/core/py/` 是本包的核心：**用真 Python（[Pyodide](https://pyodide.org/)，CPython 编译成 WASM）执行 AI 写的 Manim Python**，而不是自己手写 Python→JS 转译器、也不是手写 numpy 子集。原因是任何「手写子集」都是撞到才补，语法与库的缺口永远补不完——换成真 CPython 之后，numpy 就是 numpy 本身。链路是三段：

1. Pyodide 执行用户代码；`from manim import *` 加载我们内嵌的 Python 适配层（`manim-shim.ts`）。
2. 适配层里每个图形 / 动画 / 方法调用，都转发到若干 `_mb_*` 内置函数。
3. 这些内置函数调 `ManimBridge` 接口——浏览器里接**真桥**（落到 manim-web 对象），Host 预检时接**空桥**（只做缺失项检查）。

一处与 Skulpt 的关键差异：CPython 没法在同步函数中途让出控制权去等渲染完成，所以 `construct` 会被 `ast` 改写成 `async def`、其中的 `play` / `wait` 补上 `await`（不是正则替换，走真语法树），再由 `runPythonAsync` 的顶层 `await` 驱动。因此**每个 `Scene.play()` 都是等一下播完才往下走**，与标准 Manim 的直觉一致。

Pyodide 与随包 wheel 放在 `assets/pyodide/`：Client 走 Host 的 prefix 资源路由，Host 侧预检直接从文件系统动态 import——**随包件两端都不依赖外网**。**随包的是 `numpy` 与 `sympy`（连同 `sympy` 的依赖 `mpmath`，三个 wheel 合计约 7 MB）**（Pyodide 侧的 CPython 是 3.12，wheel 形如 `numpy-2.0.2-…-wasm32.whl` / `sympy-1.13.3-py3-none-any.whl`；`runtime.ts` 在 load 完 Pyodide 后 `loadPackage('numpy')`，因为适配层一 import 就要用）。

**其余第三方库按需取**，两层协作：

- **认**：`runPython` 每次执行前先用 Pyodide 的 `loadPackagesFromImports` 扫一遍源码里的 `import`，缺什么取什么（它认得 `from manim import *` 与标准库，不会误取——`manim` 那行每段场景都有，误判会让所有场景卡在取包阶段）。取的进展回调给卡片显示「正在加载 X…」，随包件与缓存命中都不经过这一步，所以不会闪提示。
- **取**：浏览器侧 Pyodide **只从 `indexURL` 读**——源码里 Node 侧缺包会回落官方 CDN，浏览器侧**不会**（实测确认），所以取包的唯一通道就是 Host 那条资源路由。路由按「**随包目录 → 用户缓存目录 → 回源下载**」三级找；前两级都没有，才从 Pyodide 官方发行通道（`cdn.jsdelivr.net/pyodide/v0.27.7/full/`）下载，按 `pyodide-lock.json` 里的 sha256 校验后**原子写进用户缓存目录**（先写 `.part` 再改名，中途失败不留半截文件）。缓存目录是 **`~/.dsh/cache/manim-renderer/pyodide/`**——跟随宿主的 `dshHomePath`（与附件 `cache/attachments` 同一条规则），磁盘持久、之后离线也命中，用户能看能删；**绝不写进插件目录**（那是随包产物，还可能是软链出去的仓库）。取包失败**不 reject**、只走 errorCallback，所以 `runtime.ts` 把成对的英文行（`The following error occurred while loading scipy:` + 原因）拼成一句人话（含「首次用到需要联网取一次」这层信息）再抛 `PyRuntimeError`。

`assets/pyodide/pyodide-lock.json` 是 Pyodide 的**官方包目录**（351 项）：既是「Pyodide 有哪些包」的清单，也是**回源下载时文件名与 sha256 的唯一依据**——不另写一份包清单，随包件与按需件的校验都从这一处取。要让某个包变成随包件，只需把它的 wheel（及其依赖）放进 `assets/pyodide/`，`loadPackage` 就找得到。

`api-map.generated.ts` 由 `scripts/probe-api.mjs` 对 manim-web 逐项实测生成（事实来源是 manim-web 本身），适配层据此自动生成类 / 动画别名，避免手抄漂移。

## 边界

- 规范见工作区仓 `dsh-plugins` 的 `AGENTS.md`；机制 / 安装 / 验证见技能 `cordis-plugin-development`；视觉见 `dsh-design-system`；踩坑见 `important-thing`。
- 基座模块（React 等）只来自宿主，不要把 react / react-dom 打进产物。
- 独立运行是硬要求：模块表里没有黑板 / 播放内核 / tts 时，仍能提交一段 manim Python 并在聊天流里看到可看、可重跑的卡片。
