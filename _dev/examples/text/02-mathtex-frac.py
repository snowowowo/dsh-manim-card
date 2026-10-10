"""MathTex 分式与根号

@expect 分式有横线、根号盖住被开方数，排版是公式排版。"""

from manim import *


class MathtexFracScene(Scene):
    def construct(self):
        tex = MathTex(r"\frac{a}{b} = \sqrt{c}")
        self.play(Write(tex))
        self.wait(0.3)
