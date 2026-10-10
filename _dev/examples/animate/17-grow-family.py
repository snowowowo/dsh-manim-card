"""GrowFromEdge / GrowFromCenter

@expect GrowFromCenter 从中心冒出来，GrowFromEdge 沿指定边长出来，方向不同。"""

from manim import *


class GrowFamilyScene(Scene):
    def construct(self):
        circle = Circle(radius=1, color=BLUE)
        square = Square(side_length=1.5, color=YELLOW).shift(RIGHT * 3)
        self.play(GrowFromEdge(circle, LEFT), GrowFromCenter(square))
        self.wait(0.3)
