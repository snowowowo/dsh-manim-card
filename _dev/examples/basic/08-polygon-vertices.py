"""按顶点画多边形

@expect 按给定顶点顺次连成的多边形，形状与顶点坐标相符。"""

from manim import *


class PolygonVerticesScene(Scene):
    def construct(self):
        vertices = [[-2, -1, 0], [0, 1.5, 0], [2, -1, 0]]
        poly = Polygon(*vertices, color=PURPLE)
        # 三颗灰点压在三个顶点上 + 各自的坐标小字：形状确实按这三组坐标连成
        dots = VGroup(*[Dot(v, color=GREY, radius=0.08) for v in vertices])
        label_a = Text("(-2, -1)", font_size=22).move_to([-2.3, -1.35, 0])
        label_b = Text("(0, 1.5)", font_size=22).move_to([0, 1.85, 0])
        label_c = Text("(2, -1)", font_size=22).move_to([2.3, -1.35, 0])
        labels = VGroup(label_a, label_b, label_c)
        self.play(Create(poly), FadeIn(dots), Write(labels))
        self.wait(0.3)
