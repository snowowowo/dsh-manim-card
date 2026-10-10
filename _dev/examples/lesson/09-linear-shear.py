"""线性变换：剪切

@expect 网格被剪切：横行水平错动、竖列倾斜，面积不变。
@note 讲解模板：剪切矩阵把竖直方向推向水平方向，网格最能看出来
"""

from manim import *


class ShearTransformScene(Scene):
    def construct(self):
        cells = VGroup()
        for i in range(-3, 3):
            for j in range(-3, 3):
                cell = Square(side_length=0.7, color=BLUE, stroke_width=1.5)
                cell.move_to([i * 0.7 + 0.35, j * 0.7 + 0.35, 0])
                cells.add(cell)
        title = MathTex(r"\begin{bmatrix} 1 & 1 \\ 0 & 1 \end{bmatrix}").to_edge(UP)

        self.play(Create(cells), Write(title))
        self.play(ApplyMatrix([[1, 1], [0, 1]], cells), run_time=2)
        self.wait(0.3)
