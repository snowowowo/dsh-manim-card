"""平面网格

@expect 平面网格两个方向的线都齐整，间距一致。"""

from manim import *


class NumberPlaneScene(Scene):
    def construct(self):
        plane = NumberPlane(x_range=[-4, 4, 1], y_range=[-3, 3, 1])
        self.play(Create(plane))
        self.wait(0.3)
