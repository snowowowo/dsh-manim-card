"""MoveAlongPath 沿路径走

@expect 点贴着给定路径曲线走，不是走直线。"""

from manim import *


class MoveAlongPathScene(Scene):
    def construct(self):
        circle = Circle(radius=2, color=BLUE)
        dot = Dot(point=[2, 0, 0], color=RED)
        self.add(circle, dot)
        self.play(MoveAlongPath(dot, circle), run_time=2)
        self.wait(0.3)
