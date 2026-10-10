"""API 点名：形状与标记（表里 ok、语料未用到的那一批）

@expect 一批 2D 形状与标记（弓形、十字、差异/并集、肘形、虚线化、复箭头等）各自成形、不叠死不缺角。
@note 三态表里 kind=class、state=ok 的名字点一遍。这一组只做**构造 + 加进场景**——
      形状画得对不对不是这里要管的（页面点着看），要管的是「这个名字能不能用」。
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
pt = VectorizedPoint()
unit = UnitInterval()
m1 = Mobject1D()
m2 = Mobject2D()
pm = PMobject()
vm = VMobject()
tipable = TipableVMobject()
group = Group(Square(), Circle())
box = SurroundingRectangle(Circle())
bg = BackgroundRectangle(Circle())
screen = ScreenRectangle(height=2)
full = FullScreenRectangle()

tips = VGroup(
    ArrowTip(),
    ArrowTriangleTip(),
    ArrowTriangleFilledTip(),
    ArrowCircleTip(),
    ArrowCircleFilledTip(),
    ArrowSquareTip(),
    ArrowSquareFilledTip(),
    StealthTip(),
)

plane = ComplexPlane()
polar = PolarPlane()
complex_tracker = ComplexValueTracker(1 + 1j)

print("api-classes-2d", len(tips), len(group), plane is not None)


class ApiClassesScene(Scene):
    def construct(self):
        self.add(
            sector, arcbp, arcpoly, cross, diff, excl, un, inter, elbow, dashed, cdarrow,
            cloud, mark, pt, unit, m1, m2, pm, vm, tipable, group, box, bg, screen, full,
            tips, plane, polar, complex_tracker,
        )
        self.play(Create(sector), Create(arcbp), run_time=0.2)
        self.wait(0.2)
