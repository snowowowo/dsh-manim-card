"""基变换：同一个向量的两套坐标

@expect 蓝色基与绿色基合成一个平行四边形（0.6·b₂ 那条闭合边用绿色虚线补全，并标注 1.2·b₁ / 0.6·b₂），
        黄色向量沿它们走的方式就是 (1.2, 0.6)；换成标准基去看，同一根箭头的坐标变成另一组数。
@note 讲解要点：向量本身没变，变的是「用哪两把尺子量」。所以「坐标」永远是相对基而言的，
    这句话一懂，相似矩阵 A = P⁻¹BP 就不再神秘。
"""

from manim import *


class BasisChangeScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[-2.5, 2.5, 1],
            y_range=[-2.5, 2.5, 1],
            x_length=5.0,
            y_length=5.0,
            tips=False,
            axis_config={"color": GRAY_B},
        ).shift(LEFT * 1.6)

        b1 = Arrow(ax.c2p(0, 0), ax.c2p(1, 0.8), buff=0, color=BLUE, stroke_width=4)
        b2 = Arrow(ax.c2p(0, 0), ax.c2p(-0.6, 1), buff=0, color=GREEN, stroke_width=4)
        # v = 1.2*b1 + 0.6*b2 = (1.2 - 0.36, 0.96 + 0.6) = (0.84, 1.56)
        step1 = Arrow(ax.c2p(0, 0), ax.c2p(1.2, 0.96), buff=0, color=BLUE, stroke_width=2)
        step2 = Arrow(ax.c2p(1.2, 0.96), ax.c2p(0.84, 1.56), buff=0, color=GREEN, stroke_width=2)
        # 平行四边形的闭合边（v 端点 → 0.6·b₂ 角点，平行于 b₁）：虚线 ghost 补全
        closing = DashedLine(ax.c2p(0.84, 1.56), ax.c2p(-0.36, 0.6), color=GREEN, stroke_width=2)
        corner = Dot(ax.c2p(-0.36, 0.6), radius=0.06, color=GREEN)
        vec = Arrow(ax.c2p(0, 0), ax.c2p(0.84, 1.56), buff=0, color=YELLOW, stroke_width=5)
        # 重合的 1.2·b₁ 与粗蓝 b₁ 用标注区分
        label_step1 = MathTex(r"1.2\,\vec b_1", color=BLUE, font_size=30).move_to(ax.c2p(1.85, 0.6))
        label_step2 = MathTex(r"0.6\,\vec b_2", color=GREEN, font_size=30).move_to(ax.c2p(1.6, 1.55))

        coords_new = MathTex(r"\vec v = 1.2\,\vec b_1 + 0.6\,\vec b_2", font_size=38).move_to([3.9, 0.9, 0])
        coords_std = MathTex(r"\vec v = 0.84\,\vec e_1 + 1.56\,\vec e_2", font_size=38).move_to([3.9, -0.1, 0])
        note = Text("同一个箭头，两套坐标", font_size=26, color=GRAY_A).move_to([3.9, -1.0, 0])

        self.play(Create(ax), run_time=0.8)
        self.play(GrowArrow(b1), GrowArrow(b2), run_time=0.8)
        self.play(Write(coords_new), run_time=0.6)
        self.play(GrowArrow(step1), GrowArrow(step2), Create(closing), Create(corner), run_time=1.0)
        self.play(Write(label_step1), Write(label_step2), run_time=0.6)
        self.play(GrowArrow(vec), run_time=0.8)
        self.play(Write(coords_std), Write(note), run_time=0.8)
        self.wait(0.4)
