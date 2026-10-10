"""Square 位置参数（边长）

@expect 两个只给边长位置参数的方块大小不同。"""

from manim import *


class SquarePositionalScene(Scene):
    def construct(self):
        square = Square(2, color=YELLOW)
        self.play(Create(square))
        self.wait(0.3)
