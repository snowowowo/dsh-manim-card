"""黎曼和逼近积分

@expect 矩形越分越细、矩形面积之和越来越接近定积分值：粗分 dx=1 的矩形以描边 ghost 留在终态
        与细分 dx=0.25 对照，右侧两行标注给出两档的面积和（1.60 → 2.63，真值 2.27）。
@template 要讲「细分 / 求和逼近」（黎曼和、梯形近似、级数部分和这类越分越准的画面）时照它抄。
@note 讲解模板：同一段区间把 dx 变小，矩形和逼近曲线下的面积；
    粗分矩形在 Transform 前 copy 存档，变换后以低透明度描边 add 回去，才有「从什么变到什么」的对照
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

        # 粗分存档：Transform 前抄一份，终态以低透明度描边留在原位对照
        coarse_ghost = coarse.copy().set_fill(opacity=0).set_stroke(WHITE, width=1.5, opacity=0.7)

        note_coarse = Text("dx=1 → 1.60", font_size=26, color=WHITE).move_to([3.9, 1.7, 0])
        note_fine = Text("dx=0.25 → 2.63", font_size=26, color=GREEN).move_to([3.9, 1.0, 0])
        note_true = Text("真值 ≈ 2.27", font_size=24, color=GRAY_A).move_to([3.9, 0.3, 0])

        self.play(Create(ax), Create(graph))
        self.play(Write(formula), FadeIn(coarse))
        self.play(Transform(coarse, fine))
        self.add(coarse_ghost)
        self.play(Write(note_coarse), Write(note_fine), Write(note_true), run_time=0.8)
        self.wait(0.3)
