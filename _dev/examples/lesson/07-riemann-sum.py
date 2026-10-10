"""黎曼和逼近积分

@expect 矩形越分越细、矩形面积之和越来越接近定积分值。
@note 讲解模板：同一段区间把 dx 变小，矩形和逼近曲线下的面积
"""

from manim import *


class RiemannSumScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 4, 1], y_range=[0, 4, 1])
        graph = ax.plot(lambda x: 0.4 * x * x + 0.6, color=GREEN)
        coarse = ax.get_riemann_rectangles(graph, x_range=[0, 2], dx=1)
        fine = ax.get_riemann_rectangles(graph, x_range=[0, 2], dx=0.25)
        formula = MathTex(r"\int_0^2 f(x)\,dx").to_edge(UP)

        self.play(Create(ax), Create(graph))
        self.play(Write(formula), FadeIn(coarse))
        self.play(Transform(coarse, fine))
        self.wait(0.3)
