"""黎曼矩形

@expect 一排矩形贴着曲线下沿排开，高度按取样点的函数值。"""

from manim import *


class RiemannScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 3, 1], y_range=[0, 3, 1])
        graph = ax.plot(lambda x: x * x / 3, color=GREEN)
        rects = ax.get_riemann_rectangles(graph, x_range=[0, 2], dx=0.4)
        self.play(Create(ax), Create(graph))
        self.play(FadeIn(rects))
        self.wait(0.3)
