"""按顶点画多边形

@expect 按给定顶点顺次连成的多边形，形状与顶点坐标相符。"""

from manim import *


class PolygonVerticesScene(Scene):
    def construct(self):
        poly = Polygon([-2, -1, 0], [0, 1.5, 0], [2, -1, 0], color=PURPLE)
        self.play(Create(poly))
        self.wait(0.3)
