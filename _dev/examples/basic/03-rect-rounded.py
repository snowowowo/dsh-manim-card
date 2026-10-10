"""矩形与圆角矩形

@expect 并排一个普通矩形与一个圆角矩形，四角圆滑差异肉眼可见。"""

from manim import *


class RectRoundedScene(Scene):
    def construct(self):
        rect = Rectangle(width=4, height=2, color=BLUE)
        rounded = RoundedRectangle(corner_radius=0.4, width=4, height=2, color=GREEN)
        rounded.shift(DOWN * 2.2)
        self.play(Create(rect), Create(rounded))
        self.wait(0.3)
