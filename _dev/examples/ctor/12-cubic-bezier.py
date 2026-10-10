"""CubicBezier 收四个点

@expect 曲线按四个控制点走出三次贝塞尔的形状（起终点在第一、四个点上）。"""

from manim import *


class CubicBezierScene(Scene):
    def construct(self):
        points = [[-3, -1, 0], [-1, 1.5, 0], [1, -1.5, 0], [3, 1, 0]]
        bezier = CubicBezier(*points, color=TEAL)
        # 四颗灰色控制点 + 虚线控制多边形：曲线起终点压在第一、四颗点上
        dots = VGroup(*[Dot(p, color=GREY, radius=0.08) for p in points])
        hull = VGroup(
            DashedLine(points[0], points[1], color=GREY),
            DashedLine(points[1], points[2], color=GREY),
            DashedLine(points[2], points[3], color=GREY),
        )
        self.play(Create(bezier), Create(hull), FadeIn(dots))
        self.wait(0.3)
