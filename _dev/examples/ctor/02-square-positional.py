"""Square 位置参数（边长）

@expect 两个只给边长位置参数的方块大小不同。"""

from manim import *


class SquarePositionalScene(Scene):
    def construct(self):
        # 第一个位置参数就是边长：2 与 1 两个方块大小不同
        square_big = Square(2, color=YELLOW).shift(LEFT * 3.2)
        square_small = Square(1, color=PINK).shift(RIGHT * 3.2)
        label_big = Text("边长 = 2", font_size=28, color=YELLOW)
        label_big.move_to([-3.2, -2.6, 0])
        label_small = Text("边长 = 1", font_size=28, color=PINK)
        label_small.move_to([3.2, -2.6, 0])
        self.play(Create(square_big), Write(label_big),
                  Create(square_small), Write(label_small))
        self.wait(0.3)
