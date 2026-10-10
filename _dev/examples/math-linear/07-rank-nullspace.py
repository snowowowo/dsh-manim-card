"""零空间：被映到 0 的那些方向

@expect 沿 (-2,1) 方向的箭头（红）变换后缩成一个点（原点处红点）；另一个方向（绿）变换后变成它的 2 倍长。
@note 讲解要点：零空间不是「什么都没有」，而是「本来在这里、被矩阵丢掉的整个方向」。
    秩数 = 留下来（有像）的维数，二者互为一对：留下来 1 维，被丢掉就 1 维。
"""

from manim import *


class RankNullspaceScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[-3, 5, 1],
            y_range=[-2.5, 3.5, 1],
            x_length=6.4,
            y_length=4.8,
            tips=False,
            axis_config={"color": GRAY_B},
        ).shift(LEFT * 0.8)

        null_line = DashedLine(ax.c2p(3, -1.5), ax.c2p(-1.5, 0.75), color=RED)
        null_vec = Arrow(ax.c2p(0, 0), ax.c2p(-2, 1), buff=0, color=RED, stroke_width=4)
        live_vec = Arrow(ax.c2p(0, 0), ax.c2p(2, 1), buff=0, color=GREEN, stroke_width=4)
        zero_dot = Dot(ax.c2p(0, 0), radius=0.12, color=RED)

        matrix = MathTex(r"A=\begin{bmatrix} 1 & 2 \\ 0.5 & 1 \end{bmatrix}", font_size=38).move_to([0, 3.4, 0])
        to_zero = MathTex(r"A\begin{bmatrix}-2\\1\end{bmatrix}=\begin{bmatrix}0\\0\end{bmatrix}",
                          color=RED, font_size=36).move_to([3.6, -1.8, 0])
        kept = MathTex(r"A\begin{bmatrix}2\\1\end{bmatrix}=2\begin{bmatrix}2\\1\end{bmatrix}",
                       color=GREEN, font_size=36).move_to([3.6, 2.4, 0])

        self.play(Create(ax), run_time=0.8)
        self.play(GrowArrow(null_vec), GrowArrow(live_vec), Write(matrix), run_time=1.0)
        self.play(Write(kept), run_time=0.6)
        # 箭头不进 ApplyMatrix：A·(-2,1)=(0,0) 缩成原点红点；A·(2,1)=(4,2) 变 2 倍长
        live_new = Arrow(ax.c2p(0, 0), ax.c2p(4, 2), buff=0, color=GREEN, stroke_width=4)
        self.play(ReplacementTransform(null_vec, zero_dot),
                  Transform(live_vec, live_new), run_time=2.0)
        self.play(Create(null_line), Write(to_zero), run_time=0.8)
        self.play(Circumscribe(live_vec, color=GREEN), run_time=0.6)
        self.wait(0.4)
