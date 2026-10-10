"""remove 摘掉物体

@expect 被 remove 的物体消失，其余物体原样保留。"""

from manim import *


class RemoveScene(Scene):
    def construct(self):
        a = Circle(radius=1.5, color=BLUE)
        b = Square(side_length=2, color=YELLOW)
        self.play(Create(a))
        self.play(ReplacementTransform(a, b))
        self.remove(b)
        self.wait(0.3)
