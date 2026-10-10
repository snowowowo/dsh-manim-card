"""API 点名：形状与标记（表里 ok、语料未用到的那一批）

@expect 网格布局：每个被点名的形状占一格、格下有名字标签，互不遮挡、全部在画布内。
@note 三态表里 kind=class、state=ok 的名字点一遍。这一组只做**构造 + 加进场景**——
      形状画得对不对不是这里要管的（页面点着看），要管的是「这个名字能不能用」。
      全部对象默认叠在原点，所以逐个 move_to 到网格位；格旁标注名字，谁没显示一眼可见。
"""

from manim import *

sector = AnnularSector(inner_radius=0.5, outer_radius=1, angle=PI / 2)
arcbp = ArcBetweenPoints([-1, 0, 0], [1, 0, 0], angle=PI / 2)
arcpoly = ArcPolygon([0, 1, 0], [1, -1, 0], [-1, -1, 0])
cross = Cross(Square())
diff = Difference(Square(), Circle())
excl = Exclusion(Square(), Circle())
un = Union(Square(), Circle())
inter = Intersection(Square(), Circle())
elbow = Elbow(width=1, height=1)
dashed = DashedVMobject(Circle())
cdarrow = CurvedDoubleArrow([-2, 0, 0], [2, 0, 0])
cloud = PointCloudDot()
mark = AnnotationDot()
unit = UnitInterval()
m1 = Mobject1D()
m2 = Mobject2D()
group = Group(Square(), Circle())
box = SurroundingRectangle(Circle())
# BackgroundRectangle：构造正常、加进场景后描边/填充怎么设都不可见（黑底黑块且描边被剥）——
# 适配层缺口，本条先删掉，由主线处理。
screen = ScreenRectangle(height=2).set_stroke(WHITE, 1)
full = FullScreenRectangle().set_stroke(WHITE, 1)  # height 参数被桥忽略，只能靠 scale 缩小

tips = VGroup(
    ArrowTip(),
    ArrowTriangleTip(),
    ArrowTriangleFilledTip(),
    ArrowCircleTip(),
    ArrowCircleFilledTip(),
    ArrowSquareTip(),
    ArrowSquareFilledTip(),
    StealthTip(),
).arrange(RIGHT, buff=0.2).set_stroke(WHITE, 1.5)  # 未填充的箭头尖默认描边太细，加白描边才看得见

# ComplexPlane / PolarPlane 挪到 14-planes.py 整幅展示：这两个类的背景网格在 manim-web 0.3.24 里
# 不受 x_length / radius_max 约束（ComplexPlane 永远铺满画布，PolarPlane 只认 size），塞不进这个网格；
# 又都不能 .scale()（scale 无条件量包围盒，无 WebGL 的回归环境直接炸 getBounds）。
complex_tracker = ComplexValueTracker(1 + 1j)

print("api-classes-2d", len(tips), len(group))

# —— 网格布局：pos(row, col) 给出格心，形状缩放进格、名字标在格下 ——
COLS = [-5.5, -3.3, -1.1, 1.1, 3.3, 5.5]
ROWS = [3.0, 1.7, 0.4, -0.9, -2.2]


def pos(row, col):
    return [COLS[col], ROWS[row], 0]


ITEMS = [
    ("AnnularSector", sector, 0.7),
    ("ArcBetweenPoints", arcbp, 0.7),
    ("ArcPolygon", arcpoly, 0.6),
    ("Cross", cross, 0.6),
    ("Difference", diff, 0.6),
    ("Exclusion", excl, 0.6),
    ("Union", un, 0.5),
    ("Intersection", inter, 0.5),
    ("Elbow", elbow, 0.8),
    ("DashedVMobject", dashed, 0.6),
    ("CurvedDoubleArrow", cdarrow, 0.4),
    ("PointCloudDot", cloud, 0.8),
    ("AnnotationDot", mark, 1.0),
    ("UnitInterval", unit, 0.25),
    ("Mobject1D", m1, 0.6),
    ("Mobject2D", m2, 0.3),
    ("Group", group, 0.5),
    ("SurroundingRect", box, 0.6),
    ("ScreenRectangle", screen, 0.5),
    ("ArrowTips", tips, 1.0),
    ("FullScreenRect", full, 0.1, (4, 0)),
]


class ApiClassesScene(Scene):
    def construct(self):
        for i, item in enumerate(ITEMS):
            name, mob, s = item[0], item[1], item[2]
            r, c = item[3] if len(item) > 3 else divmod(i, len(COLS))
            big = len(item) > 3  # 底行大件：形状上提、标签下移，都不压网格
            if s != 1.0:
                mob.scale(s)  # s=1.0 的（坐标系大件）不调 scale——manim-web 的 scale 无条件量包围盒
            mob.move_to([COLS[c], ROWS[r] + (0.35 if big else 0.18), 0])
            label = Text(name, font_size=11).move_to([COLS[c], ROWS[r] - (0.75 if big else 0.42), 0])
            self.add(label, mob)
        self.play(Create(sector), Create(arcbp), run_time=0.2)
        self.wait(0.2)
