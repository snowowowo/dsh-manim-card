"""奇异矩阵：det=0 把整个平面压成一条线

@expect 网格连同黄色方块被压扁成一条斜线，方块永远变不回有面积的形状。
@note 讲解要点：det=0 ⇔ 矩阵不可逆 ⇔ 信息丢了（不同的点被映到同一个点），
    所以「逆矩阵不存在」不是代数上的刁难，而是几何上「压扁了就展不平」。
"""

from manim import *


class SingularMatrixScene(Scene):
    def construct(self):
        plane = NumberPlane(
            x_range=[-4, 4, 1],
            y_range=[-3, 3, 1],
            x_length=6.4,
            y_length=4.8,
            background_line_style={"stroke_color": GRAY_D, "stroke_width": 1},
        )
        block = Square(side_length=1.6, color=YELLOW, stroke_width=3).set_fill(YELLOW, 0.35)
        block.move_to([0.8, 0.8, 0])
        det_label = MathTex(r"\det\begin{bmatrix} 1 & 2 \\ 2 & 4 \end{bmatrix} = 0", font_size=42).to_edge(UP)
        note = Text("压成了秩 1 的一条线：不可逆", font_size=30, color=RED).to_edge(DOWN, buff=0.5)

        self.play(Create(plane), run_time=1.0)
        self.play(FadeIn(block), Write(det_label), run_time=0.8)
        self.play(ApplyMatrix([[1, 2], [2, 4]], VGroup(plane, block)), run_time=2.0)
        self.play(Write(note), run_time=0.6)
        self.wait(0.4)
