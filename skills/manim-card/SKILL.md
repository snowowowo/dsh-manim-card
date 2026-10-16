---
name: manim-card
description: 用 manim_render 生成 Manim 动画卡片前必读。首选写法（完整 Python 文件）、可用的 Manim API、manim-web 实测缺失项都在这里；标准 Manim 语法照写即可。
---

# Manim 动画卡片（manim_render）

调用 `manim_render({ python })` 会在聊天流里生成一张动画卡片：进入视口自动渲染并播放。

**一段程序 = 一张卡**。要画几个画面就多调用几次，不要在一段代码里塞多个场景。

## 首选写法：写完整的 Manim Python 文件

```python
from manim import *
import numpy as np

class Demo(Scene):
    def construct(self):
        circle = Circle(radius=1, color=BLUE)
        self.play(Create(circle))
        self.wait(0.5)
```

只写 `construct` 体（不带 class 外壳）也收，但**优先写完整文件**——它是标准 Manim，读起来、迁移起来都一致。

## 语法：照标准 Manim 写就行

你的 Python 由解释器执行（不是我们手写的转译器），所以**标准 Python 3 语法都直接可用**：元组解包、切片、`*args`/`**kwargs`、嵌套 `def`、`try/except`、列表推导、`if/else`、`for/while`、`del`、下标赋值、`lambda`、类与继承……照 CE 的写法写即可，不用为"我们支持什么语法"做减法。

- `import` 行（`from manim import *` / `import numpy as np` / `import math`）正常写。
- **随包带了 `numpy` 与 `sympy`**（外加 CPython 标准库：`math` / `random` / `cmath` / `fractions` / `itertools` / `functools` …）——这两个 `import` 进来就能用，不用等、不联网。
- **其余第三方库按需取**：写 `import pandas` / `import scipy` / `import matplotlib` 之类，运行时会去把缺的包取回来（含依赖）。**首次用到需要联网一次**，取到后缓存在用户本机，之后离线也能用；取的过程中卡片上显示「正在加载 X…」，下一次不再等。当时取不到（比如断网）会明确报错并说明原因，按提示改用 `numpy` / 标准库或让用户联网后重试。
- **能随包件 + 标准库解决就别引大库**：数值、插值、简单统计、矩阵运算都用 `numpy` 与标准库自己算——引了别的库用户首次要等一次下载。要符号推导（求导、化简、解方程、`symbols` / `diff` / `integrate` / `simplify`）时 `sympy` 是随包的，直接用。
- `numpy` 是**真的 numpy（2.x 完整库，不是子集）**：`np.sin` / `np.linspace` / `np.dot` / `np.stack` / 广播 / 索引切片……照 numpy 文档写就行，`math.*` 也能用。`np` 与 CE 一样由 `from manim import *` 带出，不必自己 `import`（写了也不冲突）。
- **向量就是 ndarray，运算天然逐元素**：`UP * 0.2`、`np.array([1,2,0]) + RIGHT`、`ax.c2p(...) + vec(...)` 都按 Manim 语义算（`np.array` / `c2p` / `get_center` 返回的是 ndarray，不是普通 list）。
- **`self.play(...)` 是唯一推进画面的方式**：`self.add()` 只放不动。
- `MathTex` 的渲染等待已自动补，不用手动加 `waitForRender()`。

## 可用 API（实测确认能跑的）

> 下面这段**由 `scripts/gen-skill.mjs` 从实测三态表生成，勿手改**——改了表或重跑探针后，紧接着跑那个脚本。

<!-- gen:api-list -->
**图形与组合**：`Angle` `AnnotationDot` `AnnularSector` `Annulus` `Arc` `ArcBetweenPoints` `ArcBrace` `ArcPolygon` `ArcPolygonFromArcs` `Arrow` `Arrow3D` `ArrowCircleFilledTip` `ArrowCircleTip` `ArrowSquareFilledTip` `ArrowSquareTip` `ArrowTip` `ArrowTriangleFilledTip` `ArrowTriangleTip` `ArrowVectorField` `Axes` `BackgroundRectangle` `BarChart` `Brace` `BraceBetweenPoints` `BraceLabel` `BraceText` `BulletedList` `Circle` `Code` `ComplexPlane` `ComplexValueTracker` `Cone` `ConvexHull` `ConvexHull3D` `Cross` `Cube` `CubicBezier` `CurvedArrow` `CurvedDoubleArrow` `CurvesAsSubmobjects` `Cutout` `Cylinder` `DashedLine` `DashedVMobject` `DecimalMatrix` `DecimalNumber` `DecimalTable` `DiGraph` `Difference` `Dodecahedron` `Dot` `Dot3D` `DoubleArrow` `Elbow` `Ellipse` `Exclusion` `FullScreenRectangle` `FunctionGraph` `Graph` `Group` `Icosahedron` `ImageMobject` `ImplicitFunction` `Integer` `IntegerMatrix` `IntegerTable` `Intersection` `Label` `LabeledArrow` `LabeledDot` `LabeledLine` `LabeledPolygram` `Line` `Line3D` `LinearBase` `LinearTransformationScene` `LogBase` `ManimBanner` `MarkupText` `MathTable` `MathTex` `MathTypst` `Matrix` `Mobject` `Mobject1D` `Mobject2D` `MobjectMatrix` `MobjectTable` `MovingCameraScene` `NumberLine` `NumberPlane` `Octahedron` `PGroup` `PMobject` `Paragraph` `ParametricFunction` `PointCloudDot` `PolarPlane` `Polygon` `Polygram` `Prism` `Rectangle` `RegularPolygon` `RegularPolygram` `RightAngle` `RoundedRectangle` `SVGMobject` `SampleSpace` `Scene` `ScreenRectangle` `Sector` `SingleStringMathTex` `SpecialThreeDScene` `Sphere` `Square` `Star` `StealthTip` `StreamLines` `Surface` `SurroundingRectangle` `Table` `TangentLine` `TangentialArc` `Tetrahedron` `Tex` `Text` `ThreeDAxes` `ThreeDScene` `ThreeDVMobject` `TipableVMobject` `Title` `Torus` `Triangle` `Typst` `Underline` `Union` `UnitInterval` `VDict` `VGroup` `VMobject` `VMobjectFromSVGPath` `ValueTracker` `Variable` `Vector` `VectorField` `VectorScene` `VectorizedPoint` `ZoomedScene` `AnimatedBoundary` `TracedPath`
**动画**：`Add` `AddTextLetterByLetter` `AddTextWordByWord` `Animation` `AnimationGroup` `ApplyComplexFunction` `ApplyFunction` `ApplyMatrix` `ApplyMethod` `ApplyPointwiseFunction` `ApplyPointwiseFunctionToCenter` `ApplyWave` `Blink` `Broadcast` `ChangeDecimalToValue` `ChangeSpeed` `ChangingDecimal` `Circumscribe` `ClockwiseTransform` `ComplexHomotopy` `CounterclockwiseTransform` `Create` `CyclicReplace` `DrawBorderThenFill` `FadeIn` `FadeOut` `FadeToColor` `FadeTransform` `FadeTransformPieces` `Flash` `FocusOn` `GrowArrow` `GrowFromCenter` `GrowFromEdge` `GrowFromPoint` `Homotopy` `Indicate` `LaggedStart` `LaggedStartMap` `MoveAlongPath` `MoveToTarget` `PhaseFlow` `RemoveTextLetterByLetter` `ReplacementTransform` `Restore` `Rotate` `Rotating` `ScaleInPlace` `ShowIncreasingSubsets` `ShowPartial` `ShowPassingFlash` `ShowPassingFlashWithThinningStrokeWidth` `ShowSubmobjectsOneByOne` `ShrinkToCenter` `SmoothedVectorizedHomotopy` `SpinInFromNothing` `SpiralIn` `Succession` `Swap` `Transform` `TransformAnimations` `TransformFromCopy` `TransformMatchingShapes` `TransformMatchingTex` `TypeWithCursor` `Uncreate` `UntypeWithCursor` `Unwrite` `UpdateFromAlphaFunc` `UpdateFromFunc` `Wait` `Wiggle` `Write`
**方法**：`shift` `move_to` `scale` `rotate` `stretch` `flip` `set_fill` `set_color` `set_style` `next_to` `align_to` `to_edge` `to_corner` `arrange` `arrange_in_grid` `copy` `save_state` `restore` `become` `get_center` `get_bounding_box` `set_x` `set_y` `set_z` `add_updater` `remove_updater` `clear_updaters` `get_updaters` `get_start` `get_end` `plot` `plot_line_graph` `get_axis_labels` `c2p` `coords_to_point` `get_graph_label` `get_area` `get_riemann_rectangles` `input_to_graph_point` `get_parts` `set_value` `get_value` `interpolate`
**场景方法**：`play` `add` `remove` `wait` `clear`
**常量**：`DL` `DOWN` `DR` `IN` `LEFT` `ORIGIN` `OUT` `RIGHT` `UL` `UP` `UR` `X_AXIS` `Y_AXIS` `Z_AXIS` `DEGREES` `PI` `TAU`
**速率**：`double_smooth` `exponential_decay` `linear` `lingering` `not_quite_there` `running_start` `rush_from` `rush_into` `slow_into` `smooth` `smoothererstep` `smootherstep` `smoothstep` `there_and_back` `there_and_back_with_pause` `wiggle`
**颜色**：`BLACK` `BLUE` `BLUE_A` `BLUE_B` `BLUE_C` `BLUE_D` `BLUE_E` `DARKER_GRAY` `DARK_BLUE` `DARK_BROWN` `DARK_GRAY` `GOLD` `GOLD_A` `GOLD_B` `GOLD_C` `GOLD_D` `GOLD_E` `GRAY` `GRAY_A` `GRAY_B` `GRAY_C` `GRAY_D` `GRAY_E` `GREEN` `GREEN_A` `GREEN_B` `GREEN_C` `GREEN_D` `GREEN_E` `GREY` `GREY_A` `GREY_B` `GREY_BROWN` `GREY_C` `GREY_D` `GREY_E` `LIGHTER_GRAY` `LIGHT_BROWN` `LIGHT_GRAY` `LIGHT_PINK` `MAROON` `MAROON_A` `MAROON_B` `MAROON_C` `MAROON_D` `MAROON_E` `ORANGE` `PINK` `PURE_BLUE` `PURE_GREEN` `PURE_RED` `PURPLE` `PURPLE_A` `PURPLE_B` `PURPLE_C` `PURPLE_D` `PURPLE_E` `RED` `RED_A` `RED_B` `RED_C` `RED_D` `RED_E` `TEAL` `TEAL_A` `TEAL_B` `TEAL_C` `TEAL_D` `TEAL_E` `WHITE` `YELLOW` `YELLOW_A` `YELLOW_B` `YELLOW_C` `YELLOW_D` `YELLOW_E`
**照 CE 写、适配层自动翻译**：`set_stroke` → setStyle({ strokeColor, strokeWidth, strokeOpacity })；`set_opacity` → setStrokeOpacity(x) + setFillOpacity(x)；`put_start_and_end_on` → putStartAndEndOn(s, e)（Arrow/Vector）/ setStart(s) + setEnd(e)（Line）；`animate` → play(m.animate.x(...))；`m[i]` → getPart(i)（MathTex 取段）；`set_camera_orientation` → setCameraOrientation(phi, theta, distance)；`move_camera` → moveCamera({ phi, theta, distance, duration })；`begin_ambient_camera_rotation` → beginAmbientCameraRotation(rate)；`stop_ambient_camera_rotation` → stopAmbientCameraRotation()；`add_fixed_in_frame_mobjects` → addFixedInFrameMobjects(...mobjects)；`remove_fixed_in_frame_mobjects` → removeFixedInFrameMobjects(...mobjects)；`add_fixed_orientation_mobjects` → addFixedOrientationMobjects(...mobjects)；`remove_fixed_orientation_mobjects` → removeFixedOrientationMobjects(...mobjects)
<!-- /gen:api-list -->

清单里看不出来的两件事（手写）：

- 坐标系取点一律 `ax.c2p(x, y, 0)`；轴标签 `ax.get_axis_labels(x_label="x", y_label="y")`。
- `TracedPath` 接的是**要追踪的物体**（如 `traced = TracedPath(dot)`），不是取点函数——这点与 CE 不同。

## 引擎扩展图表（`manim_live_extra`）——标准 Manim 没有，按需用

**这是一条独立车道，不是 Manim 的一部分**：下面这些图形在标准 Manim（以及你自己的记忆）里都不存在——**默认不要用**；只有当讲解需要**统计与通用图表、某个学科的示意图（生物 / 化学 / 机器学习 / 概率 / 网络流程）、3D 曲面或分形**，而手拼 VGroup 明显不划算时，才按需引入你要的那几个：

```python
from manim import *
from manim_live_extra import Histogram   # ← 只 import 用到的，别 import *

class StatsScene(Scene):
    def construct(self):
        hist = Histogram(data=[1, 2, 2, 3, 3, 3, 4, 4, 5], bins=4, fill_opacity=0.8)
        self.play(Create(hist))
```

**代价（用之前必须掂量）**：带了这行 import 的代码**只能在浏览器里渲染**——本机 manim CLI 导出会被前置门拒绝（标准 Manim 没有这些图形），也不能拿去别的 Manim 环境跑。文件里没有这行 import，就与扩展毫无关系、随处可用。用户明确要本机 mp4 导出时，别用扩展。

写错地方也没关系：`from manim import *` 之后直接拿扩展名用，会当场报错并告诉你正确 import 是什么。

**签名速查**（全部关键字传参；颜色直接用 `from manim import *` 的常量，如 `BLUE`）：

- **统计与通用图表**：`Histogram(data=[…], bins=5, density=False)`、`BoxPlot(data=[…] 或 [[…],[…]])`、`ViolinPlot(data=[[…],[…]])`、`ScatterPlot(x=[…], y=[…])`、`StackedBarChart(values=[[…],[…]], series_names=[…])`、`AreaChart(values=[[…],[…]])`、`StepChart(values=[…], show_dots=True)`、`CalendarHeatmap(data=[{"date": "2026-06-01", "value": 3}, …])`、`CandlestickChart(data=[{"open": 1, "high": 2, "low": 0.5, "close": 1.6}, …])`、`WaterfallChart(values=[3, -1, 2], labels=[…], show_total=True)`
- **通用**：`PieChart(values=[…], labels=[…])`、`DonutChart(values=[…], labels=[…])`、`RadarChart(data=[…], categories=[…])`、`GanttChart(tasks=[{"name": "调研", "start": 0, "end": 2, "color": BLUE}, …])`
- **数学可视化**：`HeatMap(func=lambda x, y: …)`、`ContourPlot(func=lambda x, y: …)`（func 收 (x, y)、返回一个数）
- **生物**：`DNAHelix(sequence=['A', 'T', 'G', 'C'], turns=1.5, radius=1.2)`、`Cell(labels=True)`、`AminoAcidChain(residues=['G', 'A', 'V', 'L'], bead_radius=0.22)`
- **化学**：`MoleculeMobject(atoms=[{"element": "O", "x": 0, "y": 0}, …], bonds=[{"from": 0, "to": 1}, …], bond_length=1.2)`
- **机器学习**：`NeuralNetwork([FeedForwardLayer(num_nodes=3), FeedForwardLayer(num_nodes=4)], layer_spacing=2.0)`；层也能单独用——`FeedForwardLayer(num_nodes=4)`、`ConvolutionalLayer(num_feature_maps=3, map_size=3)`、`PoolingLayer(num_feature_maps=3, map_size=2)`、`ImageLayer(rows=5, cols=5, cell_size=0.5)`
- **概率**：`DiceFace(value=5, size=1.6, dot_radius=0.09)`
- **网络与流程**：`SankeyDiagram(nodes=[{"id": "A"}, …], links=[{"source": "A", "target": "C", "value": 3}, …])`
- **3D**（**必须在 `ThreeDScene` 里用**，普通 Scene 里 3D 物体会全黑）：`Box3D(width=2.5, height=1.6, depth=1.2)`、`Vector3D(end=[2, 1.5, 1.2], color=YELLOW)`、`ParametricSurface(func=lambda u, v: axes.c2p(u, v, u * v), u_range=[-2, 2], v_range=[-2, 2])`、`Surface3D(func=…)`、`ImplicitSurface(func=lambda x, y, z: x * x + y * y + z * z - 1, x_range=[-1.5, 1.5])`
- **分形**：`MandelbrotSet(width=6.0, height=3.6, max_iterations=120)`、`NewtonFractal(width=6.0, height=3.6)`

**K 线注意**：`CandlestickChart` / `WaterfallChart` 的默认色是**欧美的涨绿跌红**（`bullish_color` 默认 GREEN、`bearish_color` 默认 RED）——按中国习惯要显式传 `bullish_color=RED, bearish_color=GREEN`。

当前可用的扩展名（由探针表生成，勿手改）：

<!-- gen:extras-list -->
`Histogram` `BoxPlot` `ViolinPlot` `ScatterPlot` `StackedBarChart` `AreaChart` `StepChart` `CalendarHeatmap` `CandlestickChart` `WaterfallChart` `PieChart` `DonutChart` `RadarChart` `GanttChart` `HeatMap` `ContourPlot` `DNAHelix` `Cell` `AminoAcidChain` `MoleculeMobject` `NeuralNetwork` `FeedForwardLayer` `ConvolutionalLayer` `PoolingLayer` `ImageLayer` `DiceFace` `SankeyDiagram` `Box3D` `Vector3D` `ParametricSurface` `Surface3D` `ImplicitSurface` `MandelbrotSet` `NewtonFractal`
<!-- /gen:extras-list -->

## 3D：用 `class X(ThreeDScene)`

**只要画面里有 3D 物体（`Cube` / `Sphere` / `Cone` / `Cylinder` / `Torus` / `Prism` / 各种多面体 / `Dot3D` / `ThreeDAxes` / `Arrow3D` / `Line3D` / `ConvexHull3D`），场景类就必须写 `ThreeDScene`。**

- `ThreeDScene` 是一块**真 3D 场景**：3D 相机 + 默认光照 + 深度测试。物体有明暗、有前后遮挡。
- 把这些物体放进普通的 `Scene` 是**最典型的错**：普通场景里没有光、也不做深度，实心材质是吃光的——**画出来是一团纯黑**（不是"没实现"，是放错场景了）。`ThreeDAxes` 在 2D 场景里也会被拍平。
- 相机默认是**斜视**（phi 70° / theta -135°，Z 轴朝上）。想让观众看到某个特定角度，自己摆：

```python
class Demo(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes(x_range=[-3, 3, 1], y_range=[-3, 3, 1], z_range=[-3, 3, 1])
        cube = Cube(side_length=2, color=BLUE, opacity=0.8)   # ← 3D 实体用 color / opacity
        self.set_camera_orientation(phi=70 * DEGREES, theta=-135 * DEGREES)  # 立刻摆好
        self.add(axes, cube)
        self.move_camera(phi=60 * DEGREES, theta=-60 * DEGREES, run_time=2)   # 动画转过去
        self.play(cube.animate.shift(UP))                                     # 3D 里一样能播动画
```

- **3D 实体的颜色 / 透明用构造参数 `color` / `opacity`**。CE 的 `fill_color` / `fill_opacity` 在 manim-web 的 3D 实体上**不生效**（实测被静默忽略：仍然是默认色、仍然不透明）——别照 CE 那套写。
- **相机方法只在 `ThreeDScene` 上可用**：`set_camera_orientation(phi, theta, distance)`、`move_camera(...)`、`begin_ambient_camera_rotation(rate)` / `stop_ambient_camera_rotation()`（让相机一直慢慢转）。写在普通 `Scene` 里会当场报错。
- manim-web 的相机只有 `phi` / `theta` / `distance` 三个参数（CE 的 `gamma` / `zoom` / `focal_distance` / `frame_center` 没有，写了会报错）。
- **钉在屏幕上**（相机怎么转它都不动，标题 / 说明常用）：`self.add_fixed_in_frame_mobjects(title)`——它**自己就会把物体加进场景**（CE 就是这么做的），不用再 `self.add(title)`。
- 想让文字**跟着某件 3D 物体、又始终正对镜头**（斜视下不被压扁）：`self.add_fixed_orientation_mobjects(label)`（位置仍随相机远近变化）。
- 3D 是**透视**镜头：`phi` / `theta` 定方向、`distance` 定远近。默认距离对着「画面高 8 单位」取的，`side_length=2` 的立方体占画面高度约 1/4——东西显小就整体 `scale()`。

## 属性动画：`m.animate.*`

让物体从「现在」平滑变到「新状态」，用 `self.play(m.animate.<方法>(...))`。链返回的是一个**待播的动画对象**，必须交给 `self.play()`；单独写一行 `circle.animate.shift(UP)` 不会动（与 CE 一致）。可以链多个方法：

```python
self.play(circle.animate.shift(RIGHT * 2).scale(1.5).set_color(RED))
self.play(label.animate.to_edge(UP), run_time=0.8)
```

`m.animate` 上**只有这一组方法**可用：

<!-- gen:animate-methods -->
`with_duration` `with_rate_func` `shift` `move_to` `rotate` `scale` `set_color` `set_opacity` `set_stroke_width` `set_fill_opacity` `set_fill` `set_style` `flip` `center` `next_to` `align_to` `to_edge` `set_x` `set_y` `set_z` `set_value`
<!-- /gen:animate-methods -->

⚠️ `ValueTracker` 的数值动画写 `tracker.animate.set_value(...)` 就行——适配层会换成 manim-web 的 `animateTo`（这条与 `m.animate` 的其余方法不同：manim-web 把它做成了物体自己的方法，不在代理上，链里只放它一个）：

```python
tracker = ValueTracker(0)
dot.add_updater(lambda m: m.move_to([tracker.get_value(), 0, 0]))
self.play(tracker.animate.set_value(3))
```

要让数值**匀速变化且中途能被 updater 读到**（比如同时驱动多个物体），也可以不用动画，改用 updater 自己推进。

updater 和**更新函数动画**（`UpdateFromFunc` / `UpdateFromAlphaFunc`）的回调，第一个参数拿到的都是**真 Mobject**——`m.move_to(...)` / `m.set_opacity(...)` 这类写法照常写；单参回调（`lambda m: ...`）与双参回调（`lambda m, alpha: ...`）都收：

```python
square.add_updater(lambda m: m.move_to(origin))
self.play(UpdateFromAlphaFunc(square, lambda m, alpha: m.set_fill(BLUE, alpha)))
```

## 动画的时长与速率

`self.play(...)` 和每个动画都收 `run_time`（秒）与 `rate_func`（速率名，见上面清单里的**速率**一行）：

```python
self.play(Create(circle), run_time=2, rate_func=smooth)
self.play(FadeIn(label, shift=UP), rate_func=running_start)   # 位移淡入
```

- `rate_func` **只收清单里的速率名**（`smooth` / `linear` / `there_and_back` / `running_start`…）；写别的名字或自定义 `lambda` 都会被预检当场拒。
- 单段时长封顶 3 秒（`run_time` 写更大也只播 3 秒），别用它做长时间的等待。
- 动画构造参数（`shift=` / `scale=` / `lag_ratio=`…）照 CE 写，位置参数也照 CE 写（`Rotate(m, PI)`、`Transform(a, b)`）。

## 读属性只支持这几个

`m.width` `m.height` `m.center` `m.color` `m.opacity` `m.points`——这六个逐个走 manim-web 的真取法。**其它属性名会当场报错**，不要写 `m.某属性`；要取别的值用对应方法（如 `m.get_bounding_box()`、`m.get_start()`）。

## manim-web 实测缺失项——照替代列改

上面 API 清单之外的 Manim CE 名字，多半是 **manim-web 这个 JS 实现本身没有**（不是语法问题）。常见写法的替代：

| 不支持 | 改成 |
|---|---|
| `Surface`（参数曲面） | 用 `ParametricFunction` 画面片投影 |
| `always_redraw` / `always_rotate` / `always_shift` / `always` / `f_always` | 用 `m.add_updater(lambda m, dt: ...)` |
| `surround()` | `get_bounding_box()` 取外接框后自建 `Rectangle` |
| `plot_parametric_curve()` | 用 `ParametricFunction` |
| `plot_derivative_graph()` | 自行求导后用 `ax.plot(...)` |
| `get_part_by_tex()` | 按下标取段：`eq[i]`（等价 `eq.get_part(i)`） |
| `bring_to_front()` / `bring_to_back()` / `set_z_index()` | 用 `set_z(数值)` 调层级（manim-web 没有 Scene 级层级重排） |
| `Typst()` / `MathTypst()` | 公式一律 `MathTex`——KaTeX 渲染的是 LaTeX，不认 Typst 语法 |
| `TexTemplate()` / `tex_template=` | 不用写：公式走 KaTeX，没有 TeX 模板这一层 |
| `Point()` / `TrueDot()` / `DotCloud()` | 用 `Dot(radius=...)`；多个点用 `VGroup(*[Dot(p) for p in points])` |
| `Label()` | 用 `Text` + `BackgroundRectangle` 组装 |
| `CoordinateSystem()` / `LinearBase()` / `LogBase()` | 直接用 `Axes`（对数刻度自己换算坐标） |
| `CurvesAsSubmobjects()` | 逐段做动画用 `ParametricFunction` 拆，或 `VGroup` 拼 |
| `Section()` / `SceneFileWriter` | 视频切章 / 写文件是 CE 的导出概念，浏览器里渲染没有对应物 |

**全量缺失清单**（由表生成）——这些名字 manim-web 没有对应，直接写会被预检拒。个别名字只在 `m.animate` 链里可用，以上文那条链的清单为准：

<!-- gen:missing -->
- **类 / 形状**：`CoordinateSystem` `DefaultSectionType` `DotCloud` `ImageMobjectFromCamera` `OpenGLPGroup` `OpenGLPMPoint` `OpenGLPMobject` `Point` `SceneFileWriter` `Section` `TrueDot`
- **动画**：`MaintainPositionRelativeTo`
- **方法**：`surround` `set_z_index` `put_start_and_end` `plot_parametric_curve` `plot_derivative_graph` `get_part_by_tex` `bring_to_front` `bring_to_back`
- **函数**：`always` `always_redraw` `always_rotate` `always_shift` `assert_is_mobject_method` `cycle_animation` `f_always` `override_animation` `turn_animation_into_updater`
- **速率函数**：`squish_rate_func`
- **抽象基类（有名字但不能直接构造）**：`Polyhedron`（抽象基类，不能直接构造——用具体类：Cube / Sphere / Cone / Cylinder / Torus / Prism / Tetrahedron / Octahedron / Dodecahedron / Icosahedron）
<!-- /gen:missing -->

## 布局红线：这些写法退出码 0、画面却是坏的

干跑只证明「跑得起来」。下面每一条都来自真机截图抓到的事故——**不报错、但画面坏了**，只有渲染出来看才知道。写的时候照做，能躲开全部已知坑。

### 场景坐标与留边

画布中心是 (0,0)，上下到 ±4、左右到 ±7.1。**留边**：内容别超出 y ∈ [-3.6, 3.6]、x ∈ [-6.8, 6.8]。顶部标题带 y ≈ 3.3，说明行 y ≈ -3.3，中间留给正文。

### 公式定位：只用 `move_to` 写绝对坐标

`MathTex` 的宽高要等 KaTeX **异步**量出来。`to_edge` / `next_to` / `arrange` / `get_center()` 这类**要读包围盒**的定位，在量出来之前会按 NaN 计算——整条公式被挪出画框，**什么都不显示，退出码还是 0**。同一句公式实测：`to_edge(UP)` 时隐时现（是竞态，不是必然），`move_to([0, 3.3, 0])` 稳定。所以：

```python
# ❌ 偶发整条消失
formula = MathTex(r"p \to q \equiv \neg p \lor q", font_size=44).to_edge(UP, buff=0.3)
# ✅ 稳定
formula = MathTex(r"p \to q \equiv \neg p \lor q", font_size=44).move_to([0, 3.3, 0])
```

`Text` 没这个问题（几何是同步的），`to_edge` / `next_to` 随便用。

### 手工布局：写一个 `pos()` 算坐标

表格、点阵、节点图这类「格子对齐」的画面，写一个小函数算每格中心，别用 `next_to` 一层层堆——重叠和出框都是这么来的：

```python
def pos(row, col):
    return [left + cell * (col + 0.5), top - cell * (row + 0.5), 0]
```

要单独点名某个格子/点时，**另存一份普通 Python list**（`marks.append(dot)`），别靠 `VGroup` 下标取。

### 一个物体只进一个组

- `VGroup(*[已有物体])` 会把物体**从原组偷走**：原组从此少一块、填充也丢。
- 把同一个物体 `add` 进第二个组同样致病。要单独引用就存上面那样的 list。

### 用框「量」物体：按坐标手算，别圈组

`SurroundingRectangle(组)` 会让被量的那组**之后不再渲染**（静默消失）。真要圈就 `组.copy()`；更稳的是按坐标手算一个 `Rectangle(width=…, height=…).move_to(…)`——尤其当那些物体已经在别的组里时。

### 高亮：别用 `Indicate`

`Indicate(已填充的物体)` 会把填充剥掉（而且不稳定，同样写法有时剥有时不剥）；`Indicate(组)` 会留下染色残渣（描边被冲白、彩点消失）。要强调就 `Flash(物体, color=…)` / `Circumscribe`，或手画一个高亮 `Rectangle`——都不碰物体本身。

### `MathTex` 内容红线

- **中文不进公式**：`MathTex(r"\text{传递}")` 一个字都不显示。中文用 `Text`，公式用 `MathTex`，并排时各自 `move_to` 对齐。
- **字体切换命令整段画成空**：`\mathbb` / `\mathcal` / `\mathsf` 实测一个字形都不出来（还会去拉动态字体，控制台报 `Can't load …`）。要花体字母就用普通字母：`Z`、`P`、`V^T`。
- 间距命令（`\;` `\quad` `\qquad` `\,`）实测都安全，放心用。
- **排版完成前别动它的几何**：`MathTex` 的分段与包围盒要等 KaTeX 异步排版才存在。构造后立刻 `copy()` 当残影、`scale()`、`arrange()` 都拿到空/未填充的结构——实测排版前 copy 的残影会把 `TransformMatchingTex` 的对位数据污染成 `aˣ = y b`。要对照残影就画一个独立的灰公式用 `move_to` 摆过去，别 copy 公式本体。
- `Tex` 照数学模式排（适配层已把 `Tex` 改道 `MathTex` 管线），`Tex("E = mc^2")` 的 `^` 正常出上标。

### `Graph` 的标签看不见

`Graph(..., showLabels=True)` 的标签被顶点圆盘整个盖住，`vertexConfig={"radius": …}` 也改不动（manim-web 0.3.24）。关系图、自动机、哈斯图这类**手工搭**：`Circle` 当顶点、`Text` 贴标签、`Line` 手算坐标连线。

### numpy 与环境

- `np.math.factorial` 在 numpy 2.x 已移除 → `import math` 后用 `math.factorial`。
- `np.bincount(...)` 这类返回 int64，回传可能撞 `Cannot cast array data from dtype('int64') to dtype('int32')` → 计数用纯 Python 列表。
- `ImageMobject` 一构造就要 DOM，干跑必炸 → 别用。


## 场景模板：整段照抄，别从零拼

下面是**完整可跑**的讲解场景，每条开头的「**什么时候照它抄**」就是它的适用范式（静态定义图 / tracker 扫描 / 参数曲线 / 极限 / 细分逼近 / 线性变换 / 随机模拟对照）。要讲同类内容时，先照范式最接近的那个改——怎么摆坐标系、怎么用 `ValueTracker` 驱动、动画按什么节奏推进，照着写比凭空拼准得多。

这些模板与语料回归网是**同一批文件**（`corpus/examples/`，按 docstring 里的 `@template` 标记精选——每条入选都要说清它代表哪种范式，宁缺勿滥），每条都在回归里真跑过、真浏览器里截过图，所以照抄是安全的。

<!-- gen:templates -->
### 单位圆与三角函数线（`01-unit-circle.py`，出自「讲解场景（模板）」组）

**什么时候照它抄**：要画「一个量随角度/参数变化」的静态定义图（圆上取点 + 投影线 + 对应公式标注）时照它抄。

```python
"""单位圆与三角函数线

@expect 单位圆上一点转动，正弦 / 余弦线随角度伸缩，长度与角度对得上。
@template 要画「一个量随角度/参数变化」的静态定义图（圆上取点 + 投影线 + 对应公式标注）时照它抄。
@note 讲解模板：角度 → 圆上一点 → sin / cos 两条投影线。讲定义的静态图
"""

from manim import *
import numpy as np


class UnitCircleScene(Scene):
    def construct(self):
        radius = 1.6
        angle = 55 * DEGREES
        point = np.array([radius * np.cos(angle), radius * np.sin(angle), 0])

        circle = Circle(radius=radius, color=BLUE)
        radius_line = Line(start=ORIGIN, end=point, color=YELLOW)
        cos_leg = Line(start=ORIGIN, end=[point[0], 0, 0], color=GREEN)
        sin_leg = Line(start=[point[0], 0, 0], end=point, color=RED)
        dot = Dot(point=point, radius=0.08, color=YELLOW)
        arc = Angle([[0, 0, 0], [radius, 0, 0], point], radius=0.4)
        label_cos = MathTex(r"\cos\theta", color=GREEN).next_to(cos_leg, DOWN)
        label_sin = MathTex(r"\sin\theta", color=RED).next_to(sin_leg, RIGHT)

        self.play(Create(circle))
        self.play(Create(radius_line), FadeIn(dot), Create(arc))
        self.play(Create(cos_leg), Write(label_cos))
        self.play(Create(sin_leg), Write(label_sin))
        self.wait(0.3)
```

### 从圆上一点画出正弦波（`02-sine-wave-trace.py`，出自「讲解场景（模板）」组）

**什么时候照它抄**：要让一个点/量被 ValueTracker 驱动、边动边扫出轨迹（TracedPath / updaters）时照它抄。

```python
"""从圆上一点画出正弦波

@expect 圆上的点一边转、波形一边向右展开，画出的正是正弦曲线（振幅 ±1.2 的完整正弦，真时序下观察；极速截图帧点过疏会让 TracedPath 轨迹塌成直线，属截图假象）。
@template 要让一个点/量被 ValueTracker 驱动、边动边扫出轨迹（TracedPath / updaters）时照它抄。
@note 讲解模板：ValueTracker 驱动圆上的点，TracedPath 把它的高度扫成波形；留存截图用 --realtime 真时序重截
"""

from manim import *
import numpy as np


class SineWaveScene(Scene):
    def construct(self):
        radius = 1.2
        circle = Circle(radius=radius, color=BLUE).shift(LEFT * 3.5)
        dot = Dot(radius=0.08, color=YELLOW)
        pen = Dot(radius=0.001)
        wave = TracedPath(pen, stroke_color=YELLOW)
        tracker = ValueTracker(0)

        def follow(mob):
            angle = tracker.get_value()
            dot.move_to([-3.5 + radius * np.cos(angle), radius * np.sin(angle), 0])
            pen.move_to([0.5 + angle * 0.45, radius * np.sin(angle), 0])

        dot.add_updater(follow)
        pen.add_updater(follow)
        self.add(circle, wave, dot, pen)
        self.play(tracker.animate.set_value(TAU), run_time=3)
        self.wait(0.3)
```

### 极坐标玫瑰线（`04-polar-rose.py`，出自「讲解场景（模板）」组）

**什么时候照它抄**：要画极坐标 / 参数方程曲线（玫瑰线、螺线、摆线……manim-web 没有 plot_polar_graph）时照它抄。

```python
"""极坐标玫瑰线

@expect 玫瑰线的花瓣数与方程参数一致：左边 k=5 是 5 瓣（k 奇）、右边 k=2 是 4 瓣（2k 瓣，k 偶），
两条曲线各自配方程标注，「奇 k → k 瓣 / 偶 k → 2k 瓣」的规律对照着看得出来。
@template 要画极坐标 / 参数方程曲线（玫瑰线、螺线、摆线……manim-web 没有 plot_polar_graph）时照它抄。
@note 讲解模板：manim-web 没有 plot_polar_graph——把 r(θ) 写成参数方程交给 ParametricFunction；
    MathTex 定位只能 move_to 绝对坐标（to_edge 会拿 NaN 包围盒把公式挪出画框）
"""

from manim import *
import numpy as np


class PolarRoseScene(Scene):
    def construct(self):
        def rose(petals, scale):
            def f(t):
                r = scale * np.cos(petals * t)
                return [r * np.cos(t), r * np.sin(t), 0]
            return f

        # 左：k=5（10 瓣）；右：k=2（4 瓣）——两组并排对照
        curve_5 = ParametricFunction(rose(5, 1.7), t_range=[0, TAU, 0.02], color=BLUE)
        curve_5.move_to([-3.2, -0.4, 0])
        curve_2 = ParametricFunction(rose(2, 1.7), t_range=[0, TAU, 0.02], color=ORANGE)
        curve_2.move_to([3.2, -0.4, 0])

        title_5 = MathTex(r"r = 2\cos 5\theta", font_size=40).move_to([-3.2, 2.2, 0])
        title_2 = MathTex(r"r = 2\cos 2\theta", font_size=40).move_to([3.2, 2.2, 0])
        note_5 = Text("k=5（奇）→ 5 瓣", font_size=26, color=BLUE).move_to([-3.2, -2.9, 0])
        note_2 = Text("k=2（偶）→ 4 瓣", font_size=26, color=ORANGE).move_to([3.2, -2.9, 0])

        self.play(Write(title_5))
        self.play(Create(curve_5), FadeIn(note_5), run_time=2)
        self.play(Write(title_2))
        self.play(Create(curve_2), FadeIn(note_2), run_time=2)
        self.wait(0.3)
```

### 割线趋近切线（导数的定义）（`06-secant-tangent.py`，出自「讲解场景（模板）」组）

**什么时候照它抄**：要讲「极限 / 趋近」——一条线或一个量随参数滑动、逼近目标位置时照它抄。

```python
"""割线趋近切线（导数的定义）

@expect 割线绕切点旋转、越来越贴近切线，最终重合。
@template 要讲「极限 / 趋近」——一条线或一个量随参数滑动、逼近目标位置时照它抄。
@note 2026-10-09 真机事故原文：这段被预检误拒两次——`(pos_p() + pos_m()) / 2` 与
      `x0 + h.get_value()` 都拿 c2p / get_value 的返回值做算术，而预检把它们当成了 Mobject
      （`TypeError: unsupported operand type(s) for /: 'Mobject' and 'int'`）。
      修在支持面的 METHOD_RETURNS：预检按真桥的形状返值（坐标→向量、数值→数）。
"""

from manim import *
import numpy as np


class SecantToTangent(Scene):
    def construct(self):
        ax = Axes(
            x_range=[-0.5, 3, 1],
            y_range=[-0.5, 5, 1],
            x_length=6.0,
            y_length=4.6,
            tips=False,
            axis_config={"color": GRAY_D},
        )
        ax.shift(LEFT * 3.4 + DOWN * 0.4)
        # 轴标签手动定位：get_axis_labels 的自动定位会把 "x" 漂到轴外空白处；
        # 适配层 ax.x_axis 是函数不能 get_end，改用 c2p 手算轴末端坐标
        label_x = Text("x", font_size=30, color=GRAY_D).move_to(ax.c2p(3.15, -0.35))
        label_y = Text("y", font_size=30, color=GRAY_D).move_to(ax.c2p(-0.35, 5.25))

        graph = ax.plot(lambda x: x ** 2, x_range=[0.1, 2.3], color=BLUE)

        x0 = 1.0
        h = ValueTracker(1.0)

        def pos_p():
            return ax.c2p(x0, x0 ** 2, 0)

        def pos_q():
            x = x0 + h.get_value()
            return ax.c2p(x, x ** 2, 0)

        def pos_m():
            x = x0 + h.get_value()
            return ax.c2p(x, x0 ** 2, 0)

        # 割线
        secant = Line(pos_p(), pos_q(), color=YELLOW, stroke_width=3)
        secant.add_updater(lambda m: m.put_start_and_end_on(pos_p(), pos_q()))

        # 两点
        dot_p = Dot(pos_p(), color=WHITE, radius=0.07)
        dot_q = Dot(pos_q(), color=YELLOW, radius=0.07)
        dot_q.add_updater(lambda m: m.move_to(pos_q()))

        # 水平 / 竖直增量
        seg_dx = DashedLine(pos_p(), pos_m(), color=GRAY_B, stroke_width=2)
        seg_dx.add_updater(lambda m: m.put_start_and_end_on(pos_p(), pos_m()))
        seg_dy = DashedLine(pos_m(), pos_q(), color=GRAY_B, stroke_width=2)
        seg_dy.add_updater(lambda m: m.put_start_and_end_on(pos_m(), pos_q()))

        dx_label = MathTex("h", font_size=36, color=GRAY_A)
        dx_label.add_updater(lambda m: m.move_to((pos_p() + pos_m()) / 2 + DOWN * 0.3))
        dy_label = MathTex(r"\Delta y", font_size=36, color=GRAY_A)
        dy_label.add_updater(lambda m: m.move_to((pos_m() + pos_q()) / 2 + RIGHT * 0.42))

        # 差商公式
        eq = MathTex(r"\frac{f(x_0+h)-f(x_0)}{h}", font_size=44)
        eq.move_to([3.6, 1.0, 0])
        result = MathTex(r"f'(x_0)=2x_0", font_size=44)
        result.move_to([3.6, 1.0, 0])
        caption = MathTex(r"h\to 0", font_size=40, color=YELLOW).next_to(eq, DOWN, buff=0.7)

        # 切线
        tangent = DashedLine(
            ax.c2p(0.15, 2 * 0.15 - 1, 0),
            ax.c2p(2.5, 2 * 2.5 - 1, 0),
            color=RED,
            stroke_width=3,
        )

        self.play(Create(ax), Write(label_x), Write(label_y), run_time=1.0)
        self.play(Create(graph), run_time=1.0)
        self.play(FadeIn(dot_p), FadeIn(dot_q), run_time=0.5)
        self.play(Create(secant), run_time=0.7)
        self.play(Create(seg_dx), Create(seg_dy), Write(dx_label), Write(dy_label), run_time=0.8)
        self.play(Write(eq), run_time=0.8)
        self.play(Write(caption), run_time=0.4)

        # h 变小，割线滑向切线
        self.play(h.animate.set_value(0.12), run_time=3.0, rate_func=smooth)
        self.play(FadeIn(tangent), run_time=0.7)
        tangent_label = Text("切线", font_size=24, color=RED).move_to(ax.c2p(2.55, 4.35))
        self.play(Write(tangent_label), run_time=0.5)
        self.play(FadeTransform(eq, result), run_time=1.0)
        self.play(Indicate(result, color=YELLOW, scale_factor=1.15), run_time=0.8)
        self.wait(0.8)
```

### 黎曼和逼近积分（`07-riemann-sum.py`，出自「讲解场景（模板）」组）

**什么时候照它抄**：要讲「细分 / 求和逼近」（黎曼和、梯形近似、级数部分和这类越分越准的画面）时照它抄。

```python
"""黎曼和逼近积分

@expect 矩形越分越细、矩形面积之和越来越接近定积分值：粗分 dx=1 的矩形以描边 ghost 留在终态
        与细分 dx=0.25 对照，右侧两行标注给出两档的面积和（1.60 → 2.63，真值 2.27）。
@template 要讲「细分 / 求和逼近」（黎曼和、梯形近似、级数部分和这类越分越准的画面）时照它抄。
@note 讲解模板：同一段区间把 dx 变小，矩形和逼近曲线下的面积；
    粗分矩形在 Transform 前 copy 存档，变换后以低透明度描边 add 回去，才有「从什么变到什么」的对照
"""

from manim import *


class RiemannSumScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 4, 1], y_range=[0, 4, 1])
        # 曲线只画到 x=2.6：0.4*2.6²+0.6≈3.3，峰落在 y_range=[0,4] 内不被上缘裁断
        graph = ax.plot(lambda x: 0.4 * x * x + 0.6, x_range=[0, 2.6], color=GREEN)
        coarse = ax.get_riemann_rectangles(graph, x_range=[0, 2], dx=1)
        fine = ax.get_riemann_rectangles(graph, x_range=[0, 2], dx=0.25)
        formula = MathTex(r"\int_0^2 f(x)\,dx").move_to([0, 3.4, 0])

        # 粗分存档：Transform 前抄一份，终态以低透明度描边留在原位对照
        coarse_ghost = coarse.copy().set_fill(opacity=0).set_stroke(WHITE, width=1.5, opacity=0.7)

        note_coarse = Text("dx=1 → 1.60", font_size=26, color=WHITE).move_to([3.9, 1.7, 0])
        note_fine = Text("dx=0.25 → 2.63", font_size=26, color=GREEN).move_to([3.9, 1.0, 0])
        note_true = Text("真值 ≈ 2.27", font_size=24, color=GRAY_A).move_to([3.9, 0.3, 0])

        self.play(Create(ax), Create(graph))
        self.play(Write(formula), FadeIn(coarse))
        self.play(Transform(coarse, fine))
        self.add(coarse_ghost)
        self.play(Write(note_coarse), Write(note_fine), Write(note_true), run_time=0.8)
        self.wait(0.3)
```

### 线性变换：特征方向（`10-eigenvector.py`，出自「讲解场景（模板）」组）

**什么时候照它抄**：要讲线性变换 / 矩阵作用于图形与向量（网格变形、变换前后对照、找不变方向）时照它抄。

```python
"""线性变换：特征方向

@expect 特征方向上的向量变换后仍在这条方向上（红 v₁ 沿虚线拉长 3 倍、蓝 v₂ 不动），
灰色对照向量 u 变换后偏离原方向——偏折的与不偏折的对照着看；虚线即两条特征方向。
变换前三根向量以半透明 ghost 留原位，箭头尖附近有 λ₁=3 / λ₂=1 标注。
@template 要讲线性变换 / 矩阵作用于图形与向量（网格变形、变换前后对照、找不变方向）时照它抄。
@note 讲解模板：变换后方向不变的向量就是特征向量（A 的特征值 3 与 1，特征方向 [1,1] 与 [1,-1]）
"""

from manim import *
import numpy as np


class EigenvectorScene(Scene):
    def construct(self):
        A = np.array([[2.0, 1.0], [1.0, 2.0]])

        # 两条特征方向虚线（[1,1] 与 [1,-1]）
        dash_e1 = DashedLine([-2.9, -2.9, 0], [2.9, 2.9, 0], color=GRAY_D, stroke_width=1.5)
        dash_e2 = DashedLine([-2.9, 2.9, 0], [2.9, -2.9, 0], color=GRAY_D, stroke_width=1.5)

        # 特征向量缩短初始长度，拉长 3 倍后仍不出框
        vec_a = Arrow(start=ORIGIN, end=[0.8, 0.8, 0], color=RED, buff=0)
        vec_b = Arrow(start=ORIGIN, end=[1.5, -1.5, 0], color=BLUE, buff=0)
        # 非特征对照向量，变换后明显偏折（[1,1] 方向的 v₁ 不偏，对照才醒目）
        vec_c = Arrow(start=ORIGIN, end=[1.4, 0.2, 0], color=GRAY_B, buff=0)

        t = ValueTracker(0)

        def tip(v):
            """从初始端点插值到 A·v 的端点，供标签跟随（不用 MathTex 包围盒定位）"""
            v = np.asarray(v, dtype=float)
            w = A @ v[:2]
            return (1 - t.get_value()) * v + t.get_value() * np.array([w[0], w[1], 0.0])

        label_a = MathTex(r"\vec v_1", color=RED, font_size=36)
        label_a.add_updater(lambda m: m.move_to(tip([0.8, 0.8, 0]) + UP * 0.25 + RIGHT * 0.35))
        label_b = MathTex(r"\vec v_2", color=BLUE, font_size=36)
        label_b.add_updater(lambda m: m.move_to(tip([1.5, -1.5, 0]) + DOWN * 0.05 + RIGHT * 0.4))
        label_c = MathTex(r"\vec u", color=GRAY_B, font_size=36)
        label_c.add_updater(lambda m: m.move_to(tip([1.4, 0.2, 0]) + DOWN * 0.35))

        title = MathTex(r"A = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}").move_to([0, 3.4, 0])

        self.play(FadeIn(dash_e1), FadeIn(dash_e2))
        self.play(Create(vec_a), Create(vec_b), Create(vec_c), Write(title))
        self.play(Write(label_a), Write(label_b), Write(label_c), run_time=0.6)

        # 变换前 ghost：三根向量以低透明度留原位（不参与变换），供 before/after 对照
        ghosts = VGroup(vec_a.copy(), vec_b.copy(), vec_c.copy()).set_opacity(0.25)
        self.play(FadeIn(ghosts), run_time=0.5)

        self.play(
            ApplyMatrix([[2, 1], [1, 2]], VGroup(vec_a, vec_b, vec_c)),
            t.animate.set_value(1),
            run_time=2,
        )
        # 特征值标注：单个 MathTex 直接 move_to 到对应箭头尖附近
        lam_1 = MathTex(r"\lambda_1=3", color=RED, font_size=40).move_to([3.0, 1.9, 0])
        lam_2 = MathTex(r"\lambda_2=1", color=BLUE, font_size=40).move_to([2.3, -2.1, 0])
        self.play(Write(lam_1), Write(lam_2), run_time=0.7)
        self.wait(0.3)
```

### 概率：投骰子的频率（`11-probability-dice.py`，出自「讲解场景（模板）」组）

**什么时候照它抄**：要画「随机模拟 + 频率柱状图 + 理论值对照线」（大数定律、蒙特卡洛这类实验对照理论）时照它抄。

```python
"""概率：投骰子的频率

@expect 掷骰子次数越多，六面的频率柱越来越齐平（趋近均匀）：六根柱几乎等高（15%–18%），
实测值都贴着理论值 16.7% 的橙色虚线附近起伏。
@template 要画「随机模拟 + 频率柱状图 + 理论值对照线」（大数定律、蒙特卡洛这类实验对照理论）时照它抄。
@note 讲解模板：BarChart 画实测频率，与理论值 1/6 对照；BarChart 默认摆位偏右上、
      上缘刻度会被裁，需整体 move_to 居中偏下并收紧 y_range；刻度用整数百分比
      （适配层把两位小数刻度标签四舍五入到一位，0.05 步进会显示成重复的 0.2/0.1）；
      BarChart 实例不挂 c2p（只有 Axes 桥接），参考线按图表几何手算绝对坐标
"""

from manim import *


class DiceFrequencyScene(Scene):
    def construct(self):
        observed_pct = [15, 18, 16, 17, 16, 18]
        chart = BarChart(
            values=observed_pct,
            y_range=[0, 20, 5],
            bar_colors=[BLUE],
        )
        chart.move_to([0, -0.7, 0])
        title = Text("投骰子 600 次的频率", font_size=34).move_to([0, 3.4, 0])

        # 理论值 1/6=16.7% 的参考线：量程 20 对应轴高 5 单位（默认 y_length），
        # 16.7% 高度 = 16.7/20*5 ≈ 4.2；轴底经实测标定在 y≈-3.0
        guide = DashedLine(
            [-1.9, -3.0 + 16.7 / 20 * 5, 0],
            [1.9, -3.0 + 16.7 / 20 * 5, 0],
            color=ORANGE,
            stroke_width=2.5,
        )
        guide_label = Text("1/6 ≈ 16.7%", font_size=22, color=ORANGE)
        guide_label.move_to([2.9, -3.0 + 16.7 / 20 * 5, 0])

        self.play(Write(title))
        self.play(Create(chart))
        self.play(Create(guide), Write(guide_label))
        self.wait(0.3)
```

### 空间直角坐标系与立方体（`13-space-cube-camera.py`，出自「讲解场景（模板）」组）

**什么时候照它抄**：要画 3D 空间图形（立方体 / 球 / 多面体 / 坐标轴）或想让相机转起来时照它抄。

```python
"""空间直角坐标系与立方体

@expect 斜视看一个棱长 2 的立方体：三个面同时可见、明暗各不同（有光有深度，不是一块黑）；
        它坐在第一象限，最远的顶点 (2, 2, 2) 上有个黄点、旁边跟着黄色标注；
        三条坐标轴从原点穿出，Z 轴朝上。标题钉在画面左上角、不跟相机跑。
        相机先绕方位角自转一段，再动画转到另一侧——终帧看到的是立方体的另一组侧面，
        与初始斜视完全不同，证明相机真动了，不是被 2D 拍扁的一张脸。
@template 要画 3D 空间图形（立方体 / 球 / 多面体 / 坐标轴）或想让相机转起来时照它抄。
@note 3D 物体**必须**写 class X(ThreeDScene)：普通的 Scene 里一盏灯都没有，
      吃光的材质落进去就是一团纯黑（不是「3D 没实现」，是放错场景了）。
      屏幕上的字用 add_fixed_in_frame_mobjects 钉住；3D 里跟着物体走、又要一直正对镜头的字
      用 add_fixed_orientation_mobjects——斜视下它俩都不会被压扁。
      3D 实体的颜色 / 透明用构造参数 color / opacity（CE 的 fill_color / fill_opacity 在 3D 实体上不生效）。
"""

from manim import *

SIDE = 2.0


class SpaceCubeScene(ThreeDScene):
    def construct(self):
        # 轴比默认短一圈（默认 x∈[-6,6]、z∈[-4,4]，斜视下会顶到画面边）：
        # 立方体已经占住画面中心，轴只用来交代「这是个坐标系」。
        axes = ThreeDAxes(x_range=[-3, 3, 1], y_range=[-3, 3, 1], z_range=[-3, 3, 1])
        cube = Cube(side_length=SIDE, color=BLUE)
        cube.shift([SIDE / 2, SIDE / 2, SIDE / 2])  # 坐进第一象限，别跟坐标轴原点叠在一起
        corner = Dot3D(point=[SIDE, SIDE, SIDE], radius=0.09, color=YELLOW)

        title = Text("空间直角坐标系", font_size=32)
        title.to_corner(UL)
        self.add_fixed_in_frame_mobjects(title)  # 钉在屏幕上：不跟相机转，也不会被斜视压扁

        corner_label = Text("(2, 2, 2)", font_size=22, color=YELLOW)
        corner_label.move_to([SIDE, SIDE, SIDE + 0.5])
        self.add_fixed_orientation_mobjects(corner_label)  # 留在 3D 里，但永远正对镜头

        self.set_camera_orientation(phi=70 * DEGREES, theta=-135 * DEGREES)  # 初始斜视
        self.play(Create(axes), FadeIn(cube), FadeIn(corner), Write(title), run_time=1)
        self.begin_ambient_camera_rotation(rate=0.4)  # 相机自己绕方位角慢慢转
        self.wait(1.5)
        self.stop_ambient_camera_rotation()
        self.move_camera(phi=60 * DEGREES, theta=-20 * DEGREES, run_time=2)  # 再动画转到另一侧
        self.wait(0.2)
```
<!-- /gen:templates -->

## 报错怎么处理

工具返回前会先**干跑一遍**（只查语法、未定义名与 manim-web 实测缺失项，不真正渲染）——不通过就返回 `{ok: false, error}`：带行号，实测缺失的名字还会附上替代写法（形如 `Surface 在 manim-web 无对应——…`）。**照它改好重发一次**，不要让用户自己改。

两点要记住：

- 干跑**不画画面**。它只证明「这段代码跑得起来」，不证明画面对——位置、比例、有没有出框，仍要你自己按语义推。
- 干跑与真渲染**同判**（判定取自同一份支持面）：干跑放行的，真渲染不会在语法 / 名字 / 参数形状上再拒。

## 纪律

1. **一个对象只建一次**：同一张卡里 `circle = Circle()` 之后就引用 `circle` 做动画，别重画。
2. **别凭记忆发明 API**——不在上面清单里、也没实测过的名字，先当"不支持"，用替代列或换个写法。
3. **画面交给卡片**：不要用文字复述画面内容，一句话带过即可。
