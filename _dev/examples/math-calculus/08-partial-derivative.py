"""偏导数：分别固定 y 与固定 x 去看的斜率

@expect 左边那块画的是「固定 y=1 时 f 随 x 的变化」，右边是「固定 x=1 时 f 随 y 的变化」，
        两块各有一条过切点 (1, 1.2) 的黄色切线，斜率分别是 0.8 与 1.6，右边明显更陡。
@note 讲解要点：多元函数的「导数」得先说要沿哪个方向走——固定另一个变量，就退回一元情形。
    图上 f(x,y)=0.4(x²+2y²) 在点 (1,1)：f_x=0.8x=0.8、f_y=1.6y=1.6，所以右边明显更陡。
"""

from manim import *


class PartialDerivativeScene(Scene):
    def construct(self):
        left = Axes(x_range=[0, 2.6, 1], y_range=[0, 2.2, 1], x_length=4.6, y_length=2.8,
                    tips=False, axis_config={"color": GRAY_B}).shift(LEFT * 3.6 + DOWN * 0.6)
        right = Axes(x_range=[0, 2.0, 1], y_range=[0, 2.2, 1], x_length=4.6, y_length=2.8,
                     tips=False, axis_config={"color": GRAY_B}).shift(RIGHT * 3.6 + DOWN * 0.6)

        # 固定 y0=1：g(x) = 0.4*(x^2 + 2) → 在 x0=1 处切点 (1, 1.2)、斜率 f_x = 0.8*1 = 0.8
        # 切线 y = 1.2 + 0.8(x-1)：x=0.3 → 0.64，x=1.9 → 1.92
        cut_x = left.plot(lambda x: 0.4 * (x ** 2 + 2), x_range=[0.2, 2.4], color=BLUE)
        tan_x = Line(left.c2p(0.3, 0.64), left.c2p(1.9, 1.92), color=YELLOW)
        dot_x = Dot(left.c2p(1, 1.2), color=YELLOW)

        # 固定 x0=1：h(y) = 0.4*(1 + 2y^2) → 在 y0=1 处切点 (1, 1.2)、斜率 f_y = 1.6*1 = 1.6
        # 切线 y = 1.2 + 1.6(y-1)：y=0.4 → 0.24，y=1.5 → 2.0
        cut_y = right.plot(lambda y: 0.4 * (1 + 2 * y ** 2), x_range=[0.1, 1.9], color=GREEN)
        tan_y = Line(right.c2p(0.4, 0.24), right.c2p(1.5, 2.0), color=YELLOW)
        dot_y = Dot(right.c2p(1, 1.2), color=YELLOW)

        labels = VGroup(
            MathTex(r"\frac{\partial f}{\partial x} = 0.8", color=BLUE, font_size=36).move_to([-3.6, 2.0, 0]),
            MathTex(r"\frac{\partial f}{\partial y} = 1.6", color=GREEN, font_size=36).move_to([3.6, 2.0, 0]),
            MathTex(r"f(x,y)=0.4\left(x^2+2y^2\right)", font_size=38).to_edge(UP),
        )

        self.play(Write(labels[2]), run_time=0.8)
        self.play(Create(left), Create(cut_x), Write(labels[0]), run_time=1.0)
        self.play(Create(right), Create(cut_y), Write(labels[1]), run_time=1.0)
        self.play(Create(tan_x), FadeIn(dot_x), run_time=0.7)
        self.play(Create(tan_y), FadeIn(dot_y), run_time=0.7)
        self.wait(0.4)
