"""画一个圆

@expect 画面中央出现一个默认描边色的圆，动画是 Create 沿轮廓描出来。"""

from manim import *


class CircleScene(Scene):
    def construct(self):
        circle = Circle(radius=1.2, color=BLUE)
        self.play(Create(circle))
        self.wait(0.3)
