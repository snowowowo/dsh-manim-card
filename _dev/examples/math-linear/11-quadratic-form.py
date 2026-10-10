"""二次型：正定的椭圆 vs 不定的双曲

@expect 左边一组同心椭圆（正定：所有方向都往上弯），右边一对双曲分支（不定：有的方向往下弯）。
@note 讲解要点：二次型的「正定 / 不定」就是它的等高线是闭曲线还是开口曲线——
    判断正定不用背西尔维斯特判据，看形状就够了。
"""

from manim import *
import numpy as np


class QuadraticFormScene(Scene):
    def construct(self):
        left = Axes(
            x_range=[-2.2, 2.2, 1],
            y_range=[-1.6, 1.6, 1],
            x_length=4.0,
            y_length=3.2,
            tips=False,
            axis_config={"color": GRAY_B},
        ).shift(LEFT * 3.5 + DOWN * 0.3)
        right = Axes(
            x_range=[-2.2, 2.2, 1],
            y_range=[-1.6, 1.6, 1],
            x_length=4.0,
            y_length=3.2,
            tips=False,
            axis_config={"color": GRAY_B},
        ).shift(RIGHT * 3.5 + DOWN * 0.3)

        # 正定：x² + 4y² = r² 的等高线是椭圆
        ellipses = VGroup(*[
            ParametricFunction(lambda t, r=r: [r * np.cos(t), 0.5 * r * np.sin(t), 0],
                               t_range=[0, TAU, 0.02], color=BLUE).shift(LEFT * 3.5 + DOWN * 0.3)
            for r in [0.5, 1.0, 1.5, 2.0]
        ])
        # 不定：x² - 4y² = r² 的等高线是双曲分支（t_range 按每条 r 裁到轴框内，x 方向先出界）
        branches = VGroup()
        for r in [0.6, 1.2, 1.8]:
            t_max = min(np.arccosh(2.2 / r), np.arcsinh(1.6 / (0.5 * r))) - 0.02
            for sign in [1, -1]:
                branches.add(ParametricFunction(
                    lambda t, r=r, sign=sign, t_max=t_max: [sign * r * np.cosh(t), 0.5 * r * np.sinh(t), 0],
                    t_range=[-t_max, t_max, 0.02], color=YELLOW,
                ).shift(RIGHT * 3.5 + DOWN * 0.3))

        left_title = Text("正定：全方向向上弯", font_size=26, color=BLUE).move_to([-3.5, 2.3, 0])
        right_title = Text("不定：有方向向下弯", font_size=26, color=YELLOW).move_to([3.5, 2.3, 0])
        left_formula = MathTex(r"x^2+4y^2", color=BLUE, font_size=36).move_to([-3.5, -2.0, 0])
        right_formula = MathTex(r"x^2-4y^2", color=YELLOW, font_size=36).move_to([3.5, -2.0, 0])

        self.play(Create(left), Create(right), run_time=1.0)
        self.play(Write(left_title), Write(left_formula), run_time=0.6)
        self.play(LaggedStart(*[Create(item) for item in ellipses], lag_ratio=0.15), run_time=1.4)
        self.play(Write(right_title), Write(right_formula), run_time=0.6)
        self.play(LaggedStart(*[Create(item) for item in branches], lag_ratio=0.1), run_time=1.6)
        self.wait(0.4)
