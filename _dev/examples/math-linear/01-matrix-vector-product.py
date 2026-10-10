"""矩阵乘向量 = 列的线性组合

@expect 两个列向量 a₁ / a₂（蓝、绿）按系数各自伸缩后拼成平行四边形，对角线就是 A·x。
@note 讲解要点：A·x 不是「一堆乘法」，而是**用 x 的分量去加权 A 的各列再相加**——
    所以矩阵的列就是「基向量被搬到哪儿去了」，这句话是理解线性变换的入口。
"""

from manim import *


class MatrixVectorProductScene(Scene):
    def construct(self):
        # 等比：x 与 y 每个单位都用同一长度，否则正交/平行看起来会歪
        ax = Axes(
            x_range=[-2.5, 3.5, 1],
            y_range=[-1.5, 3.5, 1],
            x_length=6.0,
            y_length=5.0,
            tips=False,
            axis_config={"color": GRAY_B},
        ).shift(LEFT * 1.2)

        a1 = Arrow(ax.c2p(0, 0), ax.c2p(2, 0.5), buff=0, color=BLUE, stroke_width=4)
        a2 = Arrow(ax.c2p(0, 0), ax.c2p(0.5, 2), buff=0, color=GREEN, stroke_width=4)
        # x = (1.2, 0.8)：结果 = 1.2*a1 + 0.8*a2
        x1, x2 = 1.2, 0.8
        scaled1 = Arrow(ax.c2p(0, 0), ax.c2p(2 * x1, 0.5 * x1), buff=0, color=BLUE, stroke_width=2)
        scaled2 = Arrow(ax.c2p(2 * x1, 0.5 * x1), ax.c2p(2 * x1 + 0.5 * x2, 0.5 * x1 + 2 * x2),
                        buff=0, color=GREEN, stroke_width=2)
        result = Arrow(ax.c2p(0, 0), ax.c2p(2 * x1 + 0.5 * x2, 0.5 * x1 + 2 * x2),
                       buff=0, color=YELLOW, stroke_width=5)
        # 平行四边形的另一条边（虚线补全）
        ghost = DashedLine(ax.c2p(0, 0), ax.c2p(0.5 * x2, 2 * x2), color=GREEN)

        formula = MathTex(r"A\vec x = x_1\vec a_1 + x_2\vec a_2", font_size=42).to_edge(UP)
        matrix = MathTex(r"A=\begin{bmatrix} 2 & 0.5 \\ 0.5 & 2 \end{bmatrix}",
                         r"\quad \vec x=\begin{bmatrix} 1.2 \\ 0.8 \end{bmatrix}", font_size=38).move_to([4.5, 0.6, 0])

        self.play(Create(ax), Write(formula), run_time=1.0)
        self.play(GrowArrow(a1), GrowArrow(a2), run_time=0.8)
        self.play(Write(matrix), run_time=0.6)
        self.play(GrowArrow(scaled1), GrowArrow(scaled2), run_time=1.0)
        self.play(Create(ghost), run_time=0.4)
        self.play(GrowArrow(result), run_time=0.8)
        self.play(Indicate(result, color=YELLOW), run_time=0.6)
        self.wait(0.4)
