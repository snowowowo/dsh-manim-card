"""TransformMatchingTex 公式变换

@expect 公式里相同的片段原地不动、不同的片段移动补位，不是整串打碎重排。"""

from manim import *


class TransformMatchingTexScene(Scene):
    def construct(self):
        a = MathTex("a", "=", "b")
        b = MathTex("x", "=", "y")
        self.play(Write(a))
        self.play(TransformMatchingTex(a, b))
        self.wait(0.3)
