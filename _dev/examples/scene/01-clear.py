"""clear 后重新画

@expect clear 后画面清空，随后新画的物体单独出现。"""

from manim import *


class ClearScene(Scene):
    def construct(self):
        self.add(Circle(radius=1.5))
        self.wait(0.2)
        self.clear()
        self.add(Square(side_length=2))
        self.wait(0.2)
