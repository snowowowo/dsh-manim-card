"""Circle 位置参数（半径）

@expect 两个只给半径位置参数的圆大小不同，半径值与画面一致。
@note CE 里 Circle(1.5) 比 Circle(radius=1.5) 更常见
"""

from manim import *


class CirclePositionalScene(Scene):
    def construct(self):
        circle = Circle(1.5, color=BLUE)
        self.play(Create(circle))
        self.wait(0.3)
