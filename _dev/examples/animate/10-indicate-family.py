"""Indicate / Flash / Circumscribe

@expect Indicate 是原地缩放闪一下、Flash 是某点迸一下光、Circumscribe 是绕物体画个圈，三者形态不同。"""

from manim import *


class IndicateFamilyScene(Scene):
    def construct(self):
        circle = Circle(radius=1.5, color=BLUE)
        dot = Dot(color=RED)
        square = Square(side_length=1.5, color=YELLOW).shift(RIGHT * 3)
        self.add(circle, dot, square)
        self.play(Indicate(circle), Flash(dot), Circumscribe(square))
        self.wait(0.3)
