"""ReplacementTransform 换掉旧物体

@expect 变形结束后场景里是 B、A 被换掉——后续再动 A 不会再出现。"""

from manim import *


class ReplacementTransformScene(Scene):
    def construct(self):
        c = Circle(radius=1.5, color=BLUE)
        s = Square(side_length=2.5, color=GREEN)
        self.play(Create(c))
        self.play(ReplacementTransform(c, s))
        self.play(c.animate.shift(RIGHT * 3))
        self.add(Text("B 在场", font_size=28).move_to([0, -2.2, 0]))
        self.add(Text("A 再动无痕", font_size=28).move_to([0, 3.2, 0]))
        self.wait(0.3)
