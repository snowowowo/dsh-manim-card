"""行列式的几何意义：单位正方形的面积被放大 |det| 倍

@expect 网格里那个黄色单位正方形被拉成平行四边形，面积从 1 变成 2（det=2）。
@note 讲解要点：行列式不是「算出来的一堆乘积」，它是**面积（体积）的缩放因子**；
    为负表示翻转了朝向，为 0 表示整个平面被压扁（下一页那条）。
"""

from manim import *


class DeterminantAreaScene(Scene):
    def construct(self):
        plane = NumberPlane(
            x_range=[-4, 4, 1],
            y_range=[-3, 3, 1],
            x_length=6.4,
            y_length=4.8,
            background_line_style={"stroke_color": GRAY_D, "stroke_width": 1},
        )
        unit = Square(side_length=1, color=YELLOW, stroke_width=3).set_fill(YELLOW, 0.35)
        unit.move_to([0.5, 0.5, 0])
        det_label = MathTex(r"\det\begin{bmatrix} 2 & 1 \\ 0 & 1 \end{bmatrix} = 2", font_size=42).to_edge(UP)
        area_label = Text("面积：1 → 2", font_size=30, color=YELLOW).to_edge(DOWN, buff=0.5)

        self.play(Create(plane), run_time=1.0)
        self.play(FadeIn(unit), Write(det_label), run_time=0.8)
        self.play(ApplyMatrix([[2, 1], [0, 1]], VGroup(plane, unit)), run_time=2.0)
        self.play(Write(area_label), run_time=0.6)
        self.wait(0.4)
