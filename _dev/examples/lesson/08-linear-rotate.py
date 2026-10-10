"""线性变换：旋转

@expect 网格与向量整体旋转同一个角度，形状不变、朝向变。
@note 讲解模板：ApplyMatrix 把基向量与图形一起按矩阵搬过去
"""

from manim import *


class RotationTransformScene(Scene):
    def construct(self):
        basis = VGroup(
            Arrow(start=ORIGIN, end=RIGHT * 2, color=GREEN),
            Arrow(start=ORIGIN, end=UP * 2, color=BLUE),
        )
        square = Square(side_length=1.6, color=YELLOW)
        square.set_fill(YELLOW, 0.35)
        square.move_to(RIGHT + UP)
        figure = VGroup(basis, square)
        title = MathTex(r"\begin{bmatrix} 0 & -1 \\ 1 & 0 \end{bmatrix}").to_edge(UP)

        self.play(Create(figure), Write(title))
        self.play(ApplyMatrix([[0, -1], [1, 0]], figure), run_time=2)
        self.wait(0.3)
