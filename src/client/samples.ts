/**
 * 实验场的**内置样例集**：一小组覆盖面齐全的 Manim 写法，打进插件、正式安装也可用。
 *
 * 来源：每条 python 逐字取自核心包 `manim-live` 仓 `corpus/examples/` 里的语料文件
 * （含文件头的 @expect/@note 断言，出处见每条上方的注释）；title 与 expectation 也从
 * 语料文件头提炼。想换样例就去那边挑一条搬过来——**不在这里新写代码**，搬进来的
 * 都是回归网跑过、真浏览器截图验过的写法。
 *
 * 语料回归网（239 条那套）归核心包仓所有，与本页无关：这里只验「本插件在宿主里的
 * 功能表现」（卡片渲染 / 播放控制 / 查看代码 / 导出 / 预检报错），所以十来条就够。
 */
import type { VerdictCase } from 'manim-live'

/**
 * 字段名与核心包的 `ManimExample` 对齐（`expect` 是判据、`expectation` 是给人看的那句话），
 * 于是这一份样例能**直接**喂给核心包的 `isPassed` / `stateOf` / `tally`——判定口径只有一处，
 * 不会长成「插件这边算通过、演示台那边算失败」。
 */
export interface LabSample extends VerdictCase {
  id: string
  title: string
  /** 人工验收对照用的一句「应该看到什么」。 */
  expectation: string
  python: string
}

export const SAMPLES: readonly LabSample[] = [
  // 出处：corpus/examples/basic/01-circle.py
  {
    id: 'basic-circle',
    title: '画一个圆',
    expect: 'ok',
    expectation: '画面中央出现一个默认描边色的圆，Create 动画沿轮廓把它描出来。',
    python: String.raw`"""画一个圆

@expect 画面中央出现一个默认描边色的圆，动画是 Create 沿轮廓描出来。"""

from manim import *


class CircleScene(Scene):
    def construct(self):
        circle = Circle(radius=1.2)
        self.play(Create(circle))
        self.wait(0.3)
`,
  },
  // 出处：corpus/examples/animate/05-transform.py
  {
    id: 'animate-transform',
    title: 'Transform 变形',
    expect: 'ok',
    expectation: '蓝圆连续变形为黄方（形状与位置同时插值），全程是同一个物体。',
    python: String.raw`"""Transform 变形

@expect A 物体连续变形为 B 物体（形状与位置同时插值），过程中两者都是同一个物体。"""

from manim import *


class TransformScene(Scene):
    def construct(self):
        circle = Circle(radius=1, color=BLUE)
        square = Square(side_length=2, color=YELLOW)
        self.add(circle)
        self.play(Transform(circle, square))
        self.wait(0.3)
`,
  },
  // 出处：corpus/examples/basic/09-axes-plot.py
  {
    id: 'basic-axes-plot',
    title: '坐标系 + 函数曲线',
    expect: 'ok',
    expectation: '一套坐标系上画出绿色抛物线，走势与函数一致、贴着坐标刻度。',
    python: String.raw`"""坐标系 + 函数曲线

@expect 一套坐标系上画出函数曲线，曲线走势与函数一致、贴着坐标刻度。
@note plot() 的 func 是 Python 函数——要过桥，见「构造器参数」组的同项
"""

from manim import *


class AxesPlotScene(Scene):
    def construct(self):
        ax = Axes(x_range=[-3, 3, 1], y_range=[-1, 3, 1])
        graph = ax.plot(lambda x: x * x / 3, color=GREEN)
        self.play(Create(ax), Create(graph))
        self.wait(0.3)
`,
  },
  // 出处：corpus/examples/text/02-mathtex-frac.py
  {
    id: 'text-mathtex-frac',
    title: 'MathTex 分式与根号',
    expect: 'ok',
    expectation: '分式有横线、根号盖住被开方数，是公式排版（KaTeX 字体路由也要通）。',
    python: String.raw`"""MathTex 分式与根号

@expect 分式有横线、根号盖住被开方数，排版是公式排版。"""

from manim import *


class MathtexFracScene(Scene):
    def construct(self):
        tex = MathTex(r"\frac{a}{b} = \sqrt{c}")
        self.play(Write(tex))
        self.wait(0.3)
`,
  },
  // 出处：corpus/examples/text/05-bulleted-list.py
  {
    id: 'text-bulleted-list',
    title: 'BulletedList 项目列表',
    expect: 'ok',
    expectation: '三行列表整体淡入，行首有项目符号、行距整齐、左对齐。',
    python: String.raw`"""BulletedList 项目列表

@expect 多行列表每行前有项目符号，行距整齐。
@note CE 的 BulletedList(*items) 是变长位置参数，manim-web 收 items 数组
@note 适配层 BulletedList 不渲染行首圆点，改用 VGroup + Text("•  …") 拼装
"""

from manim import *


class BulletedListScene(Scene):
    def construct(self):
        lines = VGroup(
            Text("•  第一条", font_size=32),
            Text("•  第二条", font_size=32),
            Text("•  第三条", font_size=32),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.4)
        lines.move_to([0, 0, 0])
        self.play(FadeIn(lines))
        self.wait(0.3)
`,
  },
  // 出处：corpus/examples/graph/08-bar-chart.py
  {
    id: 'graph-bar-chart',
    title: '柱状图',
    expect: 'ok',
    expectation: '三根柱子红 / 蓝 / 绿三色、高低与数据一致、间距均匀，标题在图上方不压图。',
    python: String.raw`"""柱状图

@expect 三根柱子红 / 蓝 / 绿三色、高低与数据一致、间距均匀，标题在图上方不压图。"""

from manim import *


class BarChartScene(Scene):
    def construct(self):
        chart = BarChart(values=[1, 3, 2], bar_colors=[RED, BLUE, GREEN])
        chart.move_to([0, -0.6, 0])
        # 适配层 bug：bar_colors 不生效，且 set_fill 会连描边一起染——
        # 先逐根 set_fill，再单独 set_stroke 把描边改回同色。
        # 适配层没有 chart.bars：三根柱是 chart 的第 3 个子物体的 3 个孩子
        bars = chart[2]
        for bar, color in zip(bars, [RED, BLUE, GREEN]):
            bar.set_fill(color, opacity=1.0)
            bar.set_stroke(color=color)
        title = Text("三色柱状图", font_size=28, color=WHITE)
        title.move_to([0, 2.6, 0])
        self.play(Create(chart), Write(title))
        self.wait(0.3)
`,
  },
  // 出处：corpus/examples/updater/01-traced-path.py
  {
    id: 'updater-traced-path',
    title: 'TracedPath 跟随物体',
    expect: 'ok',
    expectation: '红点向右移动时，身后拖出一条黄色轨迹线，与走过的路径重合（极速档下轨迹也要被推进出来）。',
    python: String.raw`"""TracedPath 跟随物体

@expect 点移动时身后拖出一条轨迹线，轨迹与走过的路径重合。
@note ⚠️ 与 CE 写法不同：CE 收函数 dot.get_center，manim-web 收物体本身——技能文档已注明
"""

from manim import *


class TracedPathScene(Scene):
    def construct(self):
        dot = Dot(point=[-3, 0, 0], color=RED)
        path = TracedPath(dot, stroke_color=YELLOW)
        self.add(path, dot)
        self.play(dot.animate.shift(RIGHT * 6))
        self.wait(0.3)
`,
  },
  // 出处：corpus/examples/updater/05-decimal.py
  {
    id: 'updater-decimal',
    title: '数字跟着 tracker 变',
    expect: 'ok',
    expectation: '右上角的数字实时从 0.0 变到 5.0（跟着 tracker 走，不是播完才跳终值）。',
    python: String.raw`"""数字跟着 tracker 变

@expect 数字实时跟着 tracker 变（不是播完才跳到终值）。"""

from manim import *


class DecimalScene(Scene):
    def construct(self):
        tracker = ValueTracker(0)
        num = DecimalNumber(0, num_decimal_places=1)
        num.to_corner(UR)
        num.add_updater(lambda m: m.set_value(tracker.get_value()))
        self.add(tracker, num)
        self.play(tracker.animate.set_value(5), run_time=1)
        self.wait(0.3)
`,
  },
  // 出处：corpus/examples/lesson/13-space-cube-camera.py
  {
    id: 'lesson-space-cube-camera',
    title: '空间直角坐标系与立方体',
    expect: 'ok',
    expectation: '斜视中的蓝色立方体三面明暗不同；相机先自转再转到另一侧，终帧看到另一组侧面；标题钉在左上角不跟相机跑。',
    python: String.raw`"""空间直角坐标系与立方体

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
`,
  },
  // 出处：corpus/examples/reject/02-unknown-class.py
  {
    id: 'reject-unknown-class',
    title: '引用未定义的名字（应当被拒绝）',
    // 坏代码样例：渲染**失败**才算通过（验的是预检当场拒绝并说明原因那条路）。
    expect: 'reject',
    expectation: '不应当渲染：引用了 manim-web 没有的名字 FancyWidget，预检应当场报错并说明原因——这条渲染失败才算通过。',
    python: String.raw`"""manim-web 没有的类

@expect 不渲染：预检应当**当场**拒绝，报错要提到「FancyWidget」并给出可读的原因或替代写法。
@reject FancyWidget
"""

from manim import *


class UnknownClassScene(Scene):
    def construct(self):
        thing = FancyWidget(radius=1)
        self.add(thing)
`,
  },
]
