"""Dot 位置参数（坐标）

@expect 点落在传入的坐标处，不在默认原点。"""

from manim import *


class DotPositionalScene(Scene):
    def construct(self):
        dot = Dot([1.5, 1, 0], color=RED)
        self.play(GrowFromCenter(dot))
        self.wait(0.3)
