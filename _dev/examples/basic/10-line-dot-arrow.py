"""线、点、箭头

@expect 线、点、箭头各一个：箭头的一端有箭头帽，点在指定位置。"""

from manim import *


class LineDotArrowScene(Scene):
    def construct(self):
        line = Line(start=[-3, -1, 0], end=[3, -1, 0])
        dot = Dot(point=[0, 1, 0], color=RED)
        arrow = Arrow(start=[-2, 1, 0], end=[0, 1, 0], color=ORANGE)
        self.play(Create(line), FadeIn(dot), GrowArrow(arrow))
        self.wait(0.3)
