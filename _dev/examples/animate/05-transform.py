"""Transform 变形

@expect A 物体连续变形为 B 物体（形状与位置同时插值），过程中两者都是同一个物体。"""

from manim import *


class TransformScene(Scene):
    def construct(self):
        circle = Circle(radius=1, color=BLUE)
        square = Square(side_length=2, color=YELLOW)
        self.add(circle)
        self.play(Transform(circle, square))
        self.wait(0.3)
