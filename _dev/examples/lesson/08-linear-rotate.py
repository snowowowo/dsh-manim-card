"""线性变换：旋转

@expect 网格与向量整体旋转 30°（非 90° 倍数，网格斜过来朝向明显变了），形状不变；
        矩阵写成 cos/sin 30° 的形式，绿色箭头长 2 格、旋转后仍对齐网格刻度。
@note 讲解模板：ApplyMatrix 把基向量与图形一起按矩阵搬过去；
    旋转角避开 90° 的倍数——90° 时网格与原来重合，看不出转没转
"""

from manim import *
import math


class RotationTransformScene(Scene):
    def construct(self):
        c, s = math.cos(math.radians(30)), math.sin(math.radians(30))
        # 网格与向量一起参与变换，让「整体旋转」看得见
        plane = NumberPlane(
            x_range=[-3, 3, 1],
            y_range=[-3, 3, 1],
            background_line_style={"stroke_color": BLUE_D, "stroke_width": 1.5},
            axis_config={"stroke_color": GRAY_D},
        )
        basis = VGroup(
            Arrow(start=ORIGIN, end=RIGHT * 2, color=GREEN),
            Arrow(start=ORIGIN, end=UP * 2, color=BLUE),
        )
        square = Square(side_length=1.6, color=YELLOW)
        square.set_fill(YELLOW, 0.35)
        square.move_to(RIGHT + UP)
        figure = VGroup(plane, basis, square)
        title = MathTex(
            r"\begin{bmatrix} \cos 30^\circ & -\sin 30^\circ \\ \sin 30^\circ & \cos 30^\circ \end{bmatrix}"
        ).move_to([0, 3.4, 0])

        self.play(Create(figure), Write(title))
        self.play(ApplyMatrix([[c, -s], [s, c]], figure), run_time=2)
        self.wait(0.3)
