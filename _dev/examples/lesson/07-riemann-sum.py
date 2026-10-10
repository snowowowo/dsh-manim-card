"""黎曼和逼近积分

@expect 矩形越分越细、矩形面积之和越来越接近定积分值。
@template 要讲「细分 / 求和逼近」（黎曼和、梯形近似、级数部分和这类越分越准的画面）时照它抄。
@note 讲解模板：同一段区间把 dx 变小，矩形和逼近曲线下的面积
"""

from manim import *


class RiemannSumScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 4, 1], y_range=[0, 4, 1])
        # 曲线只画到 x=2.6：0.4*2.6²+0.6≈3.3，峰落在 y_range=[0,4] 内不被上缘裁断
        graph = ax.plot(lambda x: 0.4 * x * x + 0.6, x_range=[0, 2.6], color=GREEN)
        coarse = ax.get_riemann_rectangles(graph, x_range=[0, 2], dx=1)
        fine = ax.get_riemann_rectangles(graph, x_range=[0, 2], dx=0.25)
        formula = MathTex(r"\int_0^2 f(x)\,dx").move_to([0, 3.4, 0])

        self.play(Create(ax), Create(graph))
        self.play(Write(formula), FadeIn(coarse))
        self.play(Transform(coarse, fine))
        self.wait(0.3)
