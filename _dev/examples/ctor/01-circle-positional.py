"""Circle 位置参数（半径）

@expect 两个只给半径位置参数的圆大小不同，半径值与画面一致。
@note CE 里 Circle(1.5) 比 Circle(radius=1.5) 更常见
"""

from manim import *


class CirclePositionalScene(Scene):
    def construct(self):
        # 第一个位置参数就是半径：1.5 与 0.8 两个圆大小不同
        circle_big = Circle(1.5, color=BLUE).shift(LEFT * 3.2)
        circle_small = Circle(0.8, color=GREEN).shift(RIGHT * 3.2)
        label_big = Text("r = 1.5", font_size=28, color=BLUE)
        label_big.move_to([-3.2, -2.6, 0])
        label_small = Text("r = 0.8", font_size=28, color=GREEN)
        label_small.move_to([3.2, -2.6, 0])
        self.play(Create(circle_big), Write(label_big),
                  Create(circle_small), Write(label_small))
        self.wait(0.3)
