"""梯度下降：沿负梯度方向一步步走向最小值

@expect 五条同心椭圆是等高线（越里越低），折线从外圈锯齿状折向中心——步子沿负梯度在谷的两侧交替弹跳、一步步收窄，箭头标出每一步的方向。
@note 讲解要点：等高线的法线方向就是梯度方向，所以「负梯度」总是垂直于当前等高线、指向更低的那一圈；
    步长 0.75 时 y 方向过冲（1-2·0.75<0），路径在谷两侧交替弹跳着收敛——「越到谷底走得越慢」的由来是梯度变小。
"""

from manim import *
import numpy as np


class GradientDescentScene(Scene):
    def construct(self):
        # f(x,y) = x^2/4 + y^2 的等高线：椭圆 x^2/4 + y^2 = r^2
        levels = VGroup(*[
            ParametricFunction(
                lambda t, r=r: [2 * r * np.cos(t), r * np.sin(t), 0],
                t_range=[0, TAU, 0.02],
                color=GRAY_B,
            )
            for r in [0.7, 1.4, 2.1, 2.8, 3.3]
        ])

        # 真实梯度下降：x ← x(1-α/2)、y ← y(1-2α)，α=0.75 时 y 过冲翻号，路径呈锯齿
        path_points = [
            [3.5, 2.8, 0],
            [3.5 * 0.625, 2.8 * -0.5, 0],
            [3.5 * 0.625**2, 2.8 * 0.25, 0],
            [3.5 * 0.625**3, 2.8 * -0.125, 0],
            [3.5 * 0.625**4, 2.8 * 0.0625, 0],
            [3.5 * 0.625**5, 2.8 * -0.03125, 0],
        ]
        dots = VGroup(*[Dot(point, radius=0.07, color=YELLOW) for point in path_points])
        arrows = VGroup(*[
            Arrow(path_points[index], path_points[index + 1], buff=0.12, color=RED, stroke_width=3)
            for index in range(len(path_points) - 1)
        ])
        center = Dot(ORIGIN, radius=0.09, color=GREEN)

        title = MathTex(r"f(x,y)=\frac{x^2}{4}+y^2", font_size=38).to_edge(UP)
        direction = MathTex(r"-\nabla f", color=RED, font_size=34).move_to([5.0, 3.0, 0])
        bottom_note = Text("最低点", font_size=26, color=GREEN).next_to(center, DOWN, buff=0.25)

        self.play(Create(levels), Write(title), run_time=1.0)
        self.play(FadeIn(center), Write(bottom_note), run_time=0.6)
        self.play(FadeIn(dots[0]), run_time=0.4)
        # dots[1:] 这种切片在适配层取不到子物体（下标才行），所以按下标走
        for index in range(len(arrows)):
            self.play(Create(arrows[index]), FadeIn(dots[index + 1]), run_time=0.6)
        self.play(Write(direction), run_time=0.5)
        self.wait(0.4)
