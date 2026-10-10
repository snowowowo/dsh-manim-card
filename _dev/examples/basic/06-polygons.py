"""三角形与正六边形

@expect 一个三角形与一个正六边形并排，边数与名字一致。"""

from manim import *


class PolygonsScene(Scene):
    def construct(self):
        triangle = Triangle(color=YELLOW)
        hexagon = RegularPolygon(n=6, radius=1.2, color=GREEN)
        hexagon.shift(RIGHT * 3)
        self.play(Create(triangle), Create(hexagon))
        self.wait(0.3)
