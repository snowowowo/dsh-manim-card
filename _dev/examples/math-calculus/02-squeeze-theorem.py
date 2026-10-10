"""夹逼定理：x·sin(1/x) 被 ±x 夹住

@expect 中间那条高频抖动的曲线始终夹在两条直线（y=x 与 y=-x）之间，两端一起收到原点。
@note 讲解要点：抖得再厉害，只要被两条「同归于 0」的线夹住，极限就是 0——上下界比函数本身好算。
    从 0.02 起画：x→0 时 sin(1/x) 在有限采样下会漏峰，那是采样问题，不是曲线本身有界性变了。
"""

from manim import *
import numpy as np


class SqueezeTheoremScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[0, 1.5, 0.5],
            y_range=[-1.6, 1.6, 0.8],
            x_length=7.4,
            y_length=3.8,
            tips=False,
            axis_config={"color": GRAY_B},
        ).shift(DOWN * 0.2)

        upper = ax.plot(lambda x: x, x_range=[0, 1.4], color=BLUE)
        lower = ax.plot(lambda x: -x, x_range=[0, 1.4], color=BLUE)
        middle = ax.plot(lambda x: x * np.sin(1 / x), x_range=[0.02, 1.4], color=YELLOW)

        upper_label = MathTex(r"y=x", color=BLUE, font_size=34).next_to(ax.c2p(1.25, 1.25), UR, buff=0.05)
        lower_label = MathTex(r"y=-x", color=BLUE, font_size=34).next_to(ax.c2p(1.25, -1.25), DR, buff=0.05)
        middle_label = MathTex(r"y=x\sin\frac{1}{x}", color=YELLOW, font_size=34).next_to(ax.c2p(0.85, -0.75), DOWN, buff=0.25)
        title = MathTex(r"\lim_{x\to 0} x\sin\frac{1}{x} = 0", font_size=42).to_edge(UP)

        self.play(Create(ax), run_time=0.8)
        self.play(Create(upper), Create(lower), run_time=1.0)
        self.play(Write(upper_label), Write(lower_label), run_time=0.5)
        self.play(Create(middle), run_time=2.0)
        self.play(Write(middle_label), run_time=0.5)
        self.play(Write(title), run_time=0.8)
        self.play(Indicate(upper_label, color=WHITE), Indicate(lower_label, color=WHITE), run_time=0.7)
        self.wait(0.4)
