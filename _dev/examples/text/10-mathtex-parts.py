"""MathTex 多段位置参数

@expect 多段参数排成一行，段间距合理、内容顺序一致。
@note CE 的 MathTex(*tex) 是变长位置参数；manim-web 的 latex 收 string | string[]
"""

from manim import *


class MathtexPartsScene(Scene):
    def construct(self):
        eq = MathTex("E", "=", "m", "c^2")
        eq.arrange(RIGHT, buff=0.15)
        self.play(Write(eq))
        self.wait(0.3)
