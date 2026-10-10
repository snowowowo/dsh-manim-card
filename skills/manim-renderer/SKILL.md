---
name: manim-renderer
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
**图形与组合**：`Angle` `AnnotationDot` `AnnularSector` `Annulus` `Arc` `ArcBetweenPoints` `ArcBrace` `ArcPolygon` `Arrow` `Arrow3D` `ArrowCircleFilledTip` `ArrowCircleTip` `ArrowSquareFilledTip` `ArrowSquareTip` `ArrowTip` `ArrowTriangleFilledTip` `ArrowTriangleTip` `ArrowVectorField` `Axes` `BackgroundRectangle` `BarChart` `Brace` `BraceBetweenPoints` `BraceLabel` `BraceText` `BulletedList` `Circle` `Code` `ComplexPlane` `ComplexValueTracker` `Cone` `ConvexHull` `ConvexHull3D` `Cross` `Cube` `CubicBezier` `CurvedArrow` `CurvedDoubleArrow` `Cutout` `Cylinder` `DashedLine` `DashedVMobject` `DecimalMatrix` `DecimalNumber` `DecimalTable` `DiGraph` `Difference` `Dodecahedron` `Dot` `Dot3D` `DoubleArrow` `Elbow` `Ellipse` `Exclusion` `FullScreenRectangle` `FunctionGraph` `Graph` `Group` `Icosahedron` `ImageMobject` `ImplicitFunction` `Integer` `IntegerMatrix` `IntegerTable` `Intersection` `LabeledArrow` `LabeledDot` `LabeledLine` `LabeledPolygram` `Line` `Line3D` `LinearTransformationScene` `ManimBanner` `MarkupText` `MathTable` `MathTex` `Matrix` `Mobject` `Mobject1D` `Mobject2D` `MobjectMatrix` `MobjectTable` `MovingCameraScene` `NumberLine` `NumberPlane` `Octahedron` `PGroup` `PMobject` `Paragraph` `ParametricFunction` `PointCloudDot` `PolarPlane` `Polygon` `Polygram` `Prism` `Rectangle` `RegularPolygon` `RegularPolygram` `RightAngle` `RoundedRectangle` `SVGMobject` `SampleSpace` `Scene` `ScreenRectangle` `Sector` `SingleStringMathTex` `Sphere` `Square` `Star` `StealthTip` `StreamLines` `SurroundingRectangle` `Table` `TangentLine` `TangentialArc` `Tetrahedron` `Tex` `Text` `ThreeDAxes` `ThreeDScene` `ThreeDVMobject` `TipableVMobject` `Title` `Torus` `Triangle` `Underline` `Union` `UnitInterval` `VDict` `VGroup` `VMobject` `VMobjectFromSVGPath` `ValueTracker` `Variable` `Vector` `VectorField` `VectorScene` `VectorizedPoint` `ZoomedScene` `AnimatedBoundary` `TracedPath`
**动画**：`Add` `AddTextLetterByLetter` `AddTextWordByWord` `Animation` `AnimationGroup` `ApplyComplexFunction` `ApplyFunction` `ApplyMatrix` `ApplyMethod` `ApplyPointwiseFunction` `ApplyPointwiseFunctionToCenter` `ApplyWave` `Blink` `Broadcast` `ChangeDecimalToValue` `ChangeSpeed` `ChangingDecimal` `Circumscribe` `ClockwiseTransform` `ComplexHomotopy` `CounterclockwiseTransform` `Create` `CyclicReplace` `DrawBorderThenFill` `FadeIn` `FadeOut` `FadeToColor` `FadeTransform` `FadeTransformPieces` `Flash` `FocusOn` `GrowArrow` `GrowFromCenter` `GrowFromEdge` `GrowFromPoint` `Homotopy` `Indicate` `LaggedStart` `LaggedStartMap` `MoveAlongPath` `MoveToTarget` `PhaseFlow` `RemoveTextLetterByLetter` `ReplacementTransform` `Restore` `Rotate` `Rotating` `ScaleInPlace` `ShowIncreasingSubsets` `ShowPartial` `ShowPassingFlash` `ShowPassingFlashWithThinningStrokeWidth` `ShowSubmobjectsOneByOne` `ShrinkToCenter` `SmoothedVectorizedHomotopy` `SpinInFromNothing` `SpiralIn` `Succession` `Swap` `Transform` `TransformAnimations` `TransformFromCopy` `TransformMatchingShapes` `TransformMatchingTex` `TypeWithCursor` `Uncreate` `UntypeWithCursor` `Unwrite` `UpdateFromAlphaFunc` `UpdateFromFunc` `Wait` `Wiggle` `Write`
**方法**：`shift` `move_to` `scale` `rotate` `stretch` `flip` `set_fill` `set_color` `set_style` `next_to` `align_to` `to_edge` `to_corner` `arrange` `arrange_in_grid` `copy` `save_state` `restore` `become` `get_center` `get_bounding_box` `set_x` `set_y` `set_z` `add_updater` `remove_updater` `clear_updaters` `get_updaters` `get_start` `get_end` `plot` `plot_line_graph` `get_axis_labels` `c2p` `coords_to_point` `get_graph_label` `get_area` `get_riemann_rectangles` `input_to_graph_point` `get_parts` `set_value` `get_value` `interpolate`
**场景方法**：`play` `add` `remove` `wait` `clear`
**常量**：`DL` `DOWN` `DR` `IN` `LEFT` `ORIGIN` `OUT` `RIGHT` `UL` `UP` `UR` `X_AXIS` `Y_AXIS` `Z_AXIS` `DEGREES` `PI` `TAU`
**速率**：`double_smooth` `exponential_decay` `linear` `lingering` `not_quite_there` `running_start` `rush_from` `rush_into` `slow_into` `smooth` `smoothererstep` `smootherstep` `smoothstep` `there_and_back` `there_and_back_with_pause` `wiggle`
**颜色**：`BLACK` `BLUE` `BLUE_A` `BLUE_B` `BLUE_C` `BLUE_D` `BLUE_E` `DARKER_GRAY` `DARK_BLUE` `DARK_BROWN` `DARK_GRAY` `GOLD` `GOLD_A` `GOLD_B` `GOLD_C` `GOLD_D` `GOLD_E` `GRAY` `GRAY_A` `GRAY_B` `GRAY_C` `GRAY_D` `GRAY_E` `GREEN` `GREEN_A` `GREEN_B` `GREEN_C` `GREEN_D` `GREEN_E` `GREY` `GREY_A` `GREY_B` `GREY_BROWN` `GREY_C` `GREY_D` `GREY_E` `LIGHTER_GRAY` `LIGHT_BROWN` `LIGHT_GRAY` `LIGHT_PINK` `MAROON` `MAROON_A` `MAROON_B` `MAROON_C` `MAROON_D` `MAROON_E` `ORANGE` `PINK` `PURE_BLUE` `PURE_GREEN` `PURE_RED` `PURPLE` `PURPLE_A` `PURPLE_B` `PURPLE_C` `PURPLE_D` `PURPLE_E` `RED` `RED_A` `RED_B` `RED_C` `RED_D` `RED_E` `TEAL` `TEAL_A` `TEAL_B` `TEAL_C` `TEAL_D` `TEAL_E` `WHITE` `YELLOW` `YELLOW_A` `YELLOW_B` `YELLOW_C` `YELLOW_D` `YELLOW_E`
**照 CE 写、适配层自动翻译**：`set_stroke` → setStyle({ strokeColor, strokeWidth, strokeOpacity })；`set_opacity` → setStrokeOpacity(x) + setFillOpacity(x)；`put_start_and_end_on` → putStartAndEndOn(s, e)（Arrow/Vector）/ setStart(s) + setEnd(e)（Line）；`animate` → play(m.animate.x(...))；`m[i]` → getPart(i)（MathTex 取段）
<!-- /gen:api-list -->

清单里看不出来的两件事（手写）：

- 坐标系取点一律 `ax.c2p(x, y, 0)`；轴标签 `ax.get_axis_labels(x_label="x", y_label="y")`。
- `TracedPath` 接的是**要追踪的物体**（如 `traced = TracedPath(dot)`），不是取点函数——这点与 CE 不同。

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
- **类 / 形状**：`ArcPolygonFromArcs` `CoordinateSystem` `CurvesAsSubmobjects` `DefaultSectionType` `DotCloud` `ImageMobjectFromCamera` `Label` `LinearBase` `LogBase` `MathTypst` `OpenGLPGroup` `OpenGLPMPoint` `OpenGLPMobject` `Point` `SceneFileWriter` `Section` `SpecialThreeDScene` `Surface` `TrueDot` `Typst`
- **动画**：`MaintainPositionRelativeTo`
- **方法**：`surround` `set_z_index` `put_start_and_end` `plot_parametric_curve` `plot_derivative_graph` `get_part_by_tex` `bring_to_front` `bring_to_back`
- **函数**：`always` `always_redraw` `always_rotate` `always_shift` `assert_is_mobject_method` `cycle_animation` `f_always` `override_animation` `turn_animation_into_updater`
- **速率函数**：`squish_rate_func`
- **抽象基类（有名字但不能直接构造）**：`Polyhedron`（抽象基类，不能直接构造——用具体类：Cube / Sphere / Cone / Cylinder / Torus / Prism / Tetrahedron / Octahedron / Dodecahedron / Icosahedron）
<!-- /gen:missing -->

## 场景模板：整段照抄，别从零拼

下面是**完整可跑**的讲解场景（三角 / 极坐标 / 线性变换 / 微积分 / 概率）。要讲同类内容时，先照结构最接近的那个改——怎么摆坐标系、怎么用 `ValueTracker` 驱动、动画按什么节奏推进，照着写比凭空拼准得多。

这些模板与实验场的语料是**同一批文件**（`examples/lesson/`），每条都在回归里真跑过，所以照抄是安全的。

<!-- gen:templates -->
### 单位圆与三角函数线（`01-unit-circle.py`）

```python
"""单位圆与三角函数线

@expect 单位圆上一点转动，正弦 / 余弦线随角度伸缩，长度与角度对得上。
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

### 从圆上一点画出正弦波（`02-sine-wave-trace.py`）

```python
"""从圆上一点画出正弦波

@expect 圆上的点一边转、波形一边向右展开，画出的正是正弦曲线。
@note 讲解模板：ValueTracker 驱动圆上的点，TracedPath 把它的高度扫成波形
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

### 勾股定理（`03-pythagorean.py`）

```python
"""勾股定理

@expect 直角三角形三边上贴的正方形面积关系呈现 a² + b² = c²。
@note 讲解模板：直角三角形 + 两条直角边上的正方形，公式在下方
"""

from manim import *
import numpy as np


class PythagoreanScene(Scene):
    def construct(self):
        s = 0.7
        A = np.array([0.0, 0.0, 0.0])
        B = A + RIGHT * (3 * s)
        C = A + UP * (4 * s)

        triangle = Polygon(A, B, C, color=WHITE, stroke_width=4)
        a_label = MathTex("a", font_size=40, color=BLUE).move_to((A + B) / 2 + DOWN * 0.35)
        b_label = MathTex("b", font_size=40, color=GREEN).move_to((A + C) / 2 + LEFT * 0.38)
        c_label = MathTex("c", font_size=40, color=YELLOW).move_to((B + C) / 2 + UR * 0.38)

        sq_a = Polygon(A, B, B + DOWN * (3 * s), A + DOWN * (3 * s), color=BLUE, stroke_width=3)
        sq_a.set_fill(BLUE, 0.22)
        sq_b = Polygon(A, C, C + LEFT * (4 * s), A + LEFT * (4 * s), color=GREEN, stroke_width=3)
        sq_b.set_fill(GREEN, 0.22)
        offset = np.array([4 * s, 3 * s, 0.0])
        sq_c = Polygon(B, C, C + offset, B + offset, color=YELLOW, stroke_width=3)
        sq_c.set_fill(YELLOW, 0.22)

        shapes = VGroup(triangle, sq_a, sq_b, sq_c, a_label, b_label, c_label)
        shapes.shift(-shapes.get_center())

        eq = MathTex("a^2", "+", "b^2", "=", "c^2", font_size=54)
        eq.arrange(RIGHT, buff=0.16)
        eq.to_edge(DOWN, buff=0.55)

        self.play(Create(triangle), run_time=1.0)
        self.play(Write(a_label), Write(b_label), Write(c_label), run_time=0.6)
        self.play(Create(sq_a), Create(sq_b), run_time=1.0)
        self.play(Create(sq_c), run_time=1.0)
        self.play(Write(eq), run_time=0.8)
        self.play(Indicate(eq, color=WHITE, scale_factor=1.1), run_time=0.8)
        self.wait(0.5)
```

### 极坐标玫瑰线（`04-polar-rose.py`）

```python
"""极坐标玫瑰线

@expect 玫瑰线的花瓣数与方程参数一致（2k 瓣 / k 瓣的规律看得出来）。
@note 讲解模板：manim-web 没有 plot_polar_graph——把 r(θ) 写成参数方程交给 ParametricFunction
"""

from manim import *
import numpy as np


class PolarRoseScene(Scene):
    def construct(self):
        petals = 5

        def rose(t):
            r = 2.2 * np.cos(petals * t)
            return [r * np.cos(t), r * np.sin(t), 0]

        curve = ParametricFunction(rose, t_range=[0, TAU, 0.02], color=BLUE)
        title = MathTex(r"r = 2\cos 5\theta").to_edge(UP)

        self.play(Write(title))
        self.play(Create(curve), run_time=2)
        self.wait(0.3)
```

### 阿基米德螺线（`05-polar-spiral.py`）

```python
"""阿基米德螺线

@expect 螺线一圈圈等距外扩，圈距恒定（阿基米德螺线的特征）。
@note 讲解模板：r 随 θ 线性增长，同样用参数方程画
"""

from manim import *
import numpy as np


class PolarSpiralScene(Scene):
    def construct(self):
        def spiral(t):
            r = 0.35 * t
            return [r * np.cos(t), r * np.sin(t), 0]

        curve = ParametricFunction(spiral, t_range=[0, TAU * 2, 0.02], color=TEAL)
        title = MathTex(r"r = \theta").to_edge(UP)

        self.play(Write(title))
        self.play(Create(curve), run_time=2)
        self.wait(0.3)
```

### 割线趋近切线（导数的定义）（`06-secant-tangent.py`）

```python
"""割线趋近切线（导数的定义）

@expect 割线绕切点旋转、越来越贴近切线，最终重合。
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
        axis_labels = ax.get_axis_labels(x_label="x", y_label="y")

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

        self.play(Create(ax), Write(axis_labels), run_time=1.0)
        self.play(Create(graph), run_time=1.0)
        self.play(FadeIn(dot_p), FadeIn(dot_q), run_time=0.5)
        self.play(Create(secant), run_time=0.7)
        self.play(Create(seg_dx), Create(seg_dy), Write(dx_label), Write(dy_label), run_time=0.8)
        self.play(Write(eq), run_time=0.8)
        self.play(Write(caption), run_time=0.4)

        # h 变小，割线滑向切线
        self.play(h.animate.set_value(0.12), run_time=3.0, rate_func=smooth)
        self.play(FadeIn(tangent), run_time=0.7)
        self.play(FadeTransform(eq, result), run_time=1.0)
        self.play(Indicate(result, color=YELLOW, scale_factor=1.15), run_time=0.8)
        self.wait(0.8)
```

### 黎曼和逼近积分（`07-riemann-sum.py`）

```python
"""黎曼和逼近积分

@expect 矩形越分越细、矩形面积之和越来越接近定积分值。
@note 讲解模板：同一段区间把 dx 变小，矩形和逼近曲线下的面积
"""

from manim import *


class RiemannSumScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 4, 1], y_range=[0, 4, 1])
        graph = ax.plot(lambda x: 0.4 * x * x + 0.6, color=GREEN)
        coarse = ax.get_riemann_rectangles(graph, x_range=[0, 2], dx=1)
        fine = ax.get_riemann_rectangles(graph, x_range=[0, 2], dx=0.25)
        formula = MathTex(r"\int_0^2 f(x)\,dx").to_edge(UP)

        self.play(Create(ax), Create(graph))
        self.play(Write(formula), FadeIn(coarse))
        self.play(Transform(coarse, fine))
        self.wait(0.3)
```

### 线性变换：旋转（`08-linear-rotate.py`）

```python
"""线性变换：旋转

@expect 网格与向量整体旋转同一个角度，形状不变、朝向变。
@note 讲解模板：ApplyMatrix 把基向量与图形一起按矩阵搬过去
"""

from manim import *


class RotationTransformScene(Scene):
    def construct(self):
        basis = VGroup(
            Arrow(start=ORIGIN, end=RIGHT * 2, color=GREEN),
            Arrow(start=ORIGIN, end=UP * 2, color=BLUE),
        )
        square = Square(side_length=1.6, color=YELLOW)
        square.set_fill(YELLOW, 0.35)
        square.move_to(RIGHT + UP)
        figure = VGroup(basis, square)
        title = MathTex(r"\begin{bmatrix} 0 & -1 \\ 1 & 0 \end{bmatrix}").to_edge(UP)

        self.play(Create(figure), Write(title))
        self.play(ApplyMatrix([[0, -1], [1, 0]], figure), run_time=2)
        self.wait(0.3)
```

### 线性变换：剪切（`09-linear-shear.py`）

```python
"""线性变换：剪切

@expect 网格被剪切：横行水平错动、竖列倾斜，面积不变。
@note 讲解模板：剪切矩阵把竖直方向推向水平方向，网格最能看出来
"""

from manim import *


class ShearTransformScene(Scene):
    def construct(self):
        cells = VGroup()
        for i in range(-3, 3):
            for j in range(-3, 3):
                cell = Square(side_length=0.7, color=BLUE, stroke_width=1.5)
                cell.move_to([i * 0.7 + 0.35, j * 0.7 + 0.35, 0])
                cells.add(cell)
        title = MathTex(r"\begin{bmatrix} 1 & 1 \\ 0 & 1 \end{bmatrix}").to_edge(UP)

        self.play(Create(cells), Write(title))
        self.play(ApplyMatrix([[1, 1], [0, 1]], cells), run_time=2)
        self.wait(0.3)
```

### 线性变换：特征方向（`10-eigenvector.py`）

```python
"""线性变换：特征方向

@expect 特征方向上的向量变换后仍在这条方向上（只伸缩、不转向），其余向量会偏。
@note 讲解模板：变换后方向不变的向量就是特征向量（这里被拉长 3 倍 / 压到 1 倍）
"""

from manim import *


class EigenvectorScene(Scene):
    def construct(self):
        vec_a = Arrow(start=ORIGIN, end=[1.5, 1.5, 0], color=RED)
        vec_b = Arrow(start=ORIGIN, end=[1.5, -1.5, 0], color=BLUE)
        label_a = MathTex(r"\vec v_1", color=RED).next_to(vec_a, UR)
        label_b = MathTex(r"\vec v_2", color=BLUE).next_to(vec_b, DR)
        figure = VGroup(vec_a, vec_b, label_a, label_b)
        title = MathTex(r"A = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}").to_edge(UP)

        self.play(Create(figure), Write(title))
        self.play(ApplyMatrix([[2, 1], [1, 2]], figure), run_time=2)
        self.wait(0.3)
```

### 概率：投骰子的频率（`11-probability-dice.py`）

```python
"""概率：投骰子的频率

@expect 掷骰子次数越多，六面的频率柱越来越齐平（趋近均匀）。
@note 讲解模板：BarChart 画实测频率，与理论值 1/6 对照
"""

from manim import *


class DiceFrequencyScene(Scene):
    def construct(self):
        observed = [0.15, 0.18, 0.16, 0.17, 0.16, 0.18]
        chart = BarChart(values=observed, bar_colors=[BLUE])
        title = Text("投骰子 600 次的频率", font_size=34).to_edge(UP)

        self.play(Write(title))
        self.play(Create(chart))
        self.wait(0.3)
```

### 概率：二项分布（`12-probability-binomial.py`）

```python
"""概率：二项分布

@expect 二项分布的柱状图呈中间高两边低的钟形，参数决定胖瘦。
@note 讲解模板：n 次试验成功 k 次的概率——柱状图随 n 变大而变高变窄
"""

from manim import *
import math


class BinomialScene(Scene):
    def construct(self):
        counts = [math.comb(10, k) * 0.5 ** 10 for k in range(11)]
        chart = BarChart(values=counts, bar_colors=[GREEN])
        title = MathTex(r"n=10,\ p=0.5").to_edge(UP)

        self.play(Write(title))
        self.play(Create(chart))
        self.wait(0.3)
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
