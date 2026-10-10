"""ReplacementTransform 换掉旧物体

@expect 变形结束后场景里是 B、A 被换掉——后续再动 A 不会再出现。"""

from manim import *


class ReplacementTransformScene(Scene):
    def construct(self):
        c = Circle(radius=1.5, color=BLUE)
        s = Square(side_length=2.5, color=GREEN)
        self.play(Create(c))
        self.play(ReplacementTransform(c, s))
        self.wait(0.3)
