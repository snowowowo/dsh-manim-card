"""特征方向：变换后方向不变的向量

@expect 两条虚线标出的方向上，向量变换后仍落在同一条直线上（只被拉长/压短）；第三个向量明显偏转。
    变换前三根向量以半透明 ghost 留在画面，与变换后的实色向量形成 before/after 对照。
@note 讲解要点：特征向量就是「这个变换自己的方向」——沿它走只改长度不改方向，长度比就是特征值。
    这里 (1,1) 被拉 3 倍、(1,-1) 保持 1 倍，所以 A 的两个特征值是 3 和 1。
"""

from manim import *


class EigenvectorScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[-4, 4, 1],
            y_range=[-3.5, 3.5, 1],
            x_length=6.4,
            y_length=5.6,
            tips=False,
            axis_config={"color": GRAY_B},
        )

        # 两条特征方向上的参考直线（虚）
        line_1 = DashedLine(ax.c2p(-3.2, -3.2), ax.c2p(3.2, 3.2), color=GRAY_B)
        line_2 = DashedLine(ax.c2p(-3.2, 3.2), ax.c2p(3.2, -3.2), color=GRAY_B)

        v1 = Arrow(ax.c2p(0, 0), ax.c2p(1.2, 1.2), buff=0, color=RED, stroke_width=4)
        v2 = Arrow(ax.c2p(0, 0), ax.c2p(1.2, -1.2), buff=0, color=BLUE, stroke_width=4)
        v3 = Arrow(ax.c2p(0, 0), ax.c2p(2.0, 0.3), buff=0, color=GREEN, stroke_width=3)

        label_1 = MathTex(r"\lambda_1 = 3", color=RED, font_size=34).move_to([3.6, 2.6, 0])
        label_2 = MathTex(r"\lambda_2 = 1", color=BLUE, font_size=34).move_to([3.6, -2.6, 0])
        matrix = MathTex(r"A=\begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}", font_size=38).move_to([0, 3.4, 0])

        self.play(Create(ax), Create(line_1), Create(line_2), run_time=1.0)
        self.play(GrowArrow(v1), GrowArrow(v2), GrowArrow(v3), Write(matrix), run_time=1.0)

        # 变换前 ghost：半透明副本留在画面，不参与变换，供 before/after 对照
        ghosts = [m.copy().set_opacity(0.3) for m in (v1, v2, v3)]
        self.play(*[FadeIn(g, scale=0.9) for g in ghosts], run_time=0.6)

        # 变换只作用在原向量上：箭头不进 ApplyMatrix，按手算端点重画后 Transform
        A = [[2, 1], [1, 2]]

        def apply_A(x, y):
            return (A[0][0] * x + A[0][1] * y, A[1][0] * x + A[1][1] * y)

        ends = [(1.2, 1.2), (1.2, -1.2), (2.0, 0.3)]
        colors_widths = [(RED, 4), (BLUE, 4), (GREEN, 3)]
        new_arrows = [
            Arrow(ax.c2p(0, 0), ax.c2p(*apply_A(x, y)), buff=0, color=c, stroke_width=w)
            for (x, y), (c, w) in zip(ends, colors_widths)
        ]
        self.play(
            Transform(v1, new_arrows[0]),
            Transform(v2, new_arrows[1]),
            Transform(v3, new_arrows[2]),
            run_time=2.0,
        )
        self.play(Write(label_1), Write(label_2), run_time=0.7)
        self.play(Circumscribe(v3, color=GREEN), run_time=0.6)
        self.wait(0.4)
