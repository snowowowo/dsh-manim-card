"""Rotating 绕轴转

@expect 物体绕指定轴连续转过去（多圈/指定角度），不是瞬间转到位。"""

from manim import *


class RotatingScene(Scene):
    def construct(self):
        square = Square(side_length=2)
        self.play(Create(square))
        self.play(Rotating(square, angle=PI, run_time=2))
        self.wait(0.3)
