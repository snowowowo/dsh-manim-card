"""线性变换：特征方向

@expect 特征方向上的向量变换后仍在这条方向上（只伸缩、不转向），其余向量会偏。
@note 讲解模板：变换后方向不变的向量就是特征向量（这里被拉长 3 倍 / 压到 1 倍）
"""

from manim import *


class EigenvectorScene(Scene):
    def construct(self):
        vec_a = Arrow(start=ORIGIN, end=[1.5, 1.5, 0], color=RED)
        vec_b = Arrow(start=ORIGIN, end=[1.5, -1.5, 0], color=BLUE)
        label_a = MathTex(r"\vec v_1", color=RED).next_to(vec_a, UR)
        label_b = MathTex(r"\vec v_2", color=BLUE).next_to(vec_b, DR)
        figure = VGroup(vec_a, vec_b, label_a, label_b)
        title = MathTex(r"A = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}").to_edge(UP)

        self.play(Create(figure), Write(title))
        self.play(ApplyMatrix([[2, 1], [1, 2]], figure), run_time=2)
        self.wait(0.3)
