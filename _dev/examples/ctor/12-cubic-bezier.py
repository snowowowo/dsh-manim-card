"""CubicBezier 收四个点

@expect 曲线按四个控制点走出三次贝塞尔的形状（起终点在第一、四个点上）。"""

from manim import *


class CubicBezierScene(Scene):
    def construct(self):
        bezier = CubicBezier([-3, -1, 0], [-1, 1.5, 0], [1, -1.5, 0], [3, 1, 0], color=TEAL)
        self.play(Create(bezier))
        self.wait(0.3)
