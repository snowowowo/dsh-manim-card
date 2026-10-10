"""LaggedStart 依次入场

@expect 多个物体依次入场，彼此有先后错峰（lag_ratio 决定重叠程度）。"""

from manim import *


class LaggedStartScene(Scene):
    def construct(self):
        dots = [Dot(point=[i - 2, 0, 0], color=BLUE) for i in range(5)]
        self.add(VGroup(*dots))
        self.play(LaggedStart(*[FadeIn(d) for d in dots], lag_ratio=0.2))
        self.wait(0.3)
