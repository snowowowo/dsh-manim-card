"""become 换形

@expect 播完后物体变成了目标形状（become 是直接换形，不是复制一份）。"""

from manim import *


class BecomeScene(Scene):
    def construct(self):
        circle = Circle(radius=1, color=BLUE)
        square = Square(side_length=2, color=YELLOW)
        self.add(square)
        square.become(circle)
        self.wait(0.3)
