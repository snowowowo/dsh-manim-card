"""get_center 参与定位

@expect 用 get_center 的返回值定位出的物体，中心正落在预期位置。"""

from manim import *


class GetCenterScene(Scene):
    def construct(self):
        circle = Circle(radius=1, color=BLUE)
        dot = Dot(point=circle.get_center() + UP * 2, color=RED)
        self.play(Create(circle), FadeIn(dot))
        self.wait(0.3)
