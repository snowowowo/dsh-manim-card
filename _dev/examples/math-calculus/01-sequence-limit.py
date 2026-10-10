"""数列极限：a_n = 1 + 1/n 逼近 1

@expect 一排点随 n 增大越挤越密，逐渐贴上 y=1 那条虚线，但永远不与之相交。
@note 讲解要点：极限是「点在过程中趋近的那个值」，不是某一步取到的值——所以虚线画断的（取不到）。
"""

from manim import *


class SequenceLimitScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[0, 12, 2],
            y_range=[0, 2.4, 0.5],
            x_length=8.0,
            y_length=3.2,
            tips=False,
            axis_config={"color": GRAY_B},
        )
        ax.shift(DOWN * 0.7)

        limit_line = DashedLine(ax.c2p(0, 1), ax.c2p(12, 1), color=RED)
        limit_label = MathTex(r"L=1", color=RED, font_size=36).next_to(limit_line, RIGHT, buff=0.15)
        dots = VGroup(*[Dot(ax.c2p(n, 1 + 1 / n), radius=0.06, color=YELLOW) for n in range(1, 13)])
        formula = MathTex(r"a_n = 1 + \frac{1}{n}", font_size=42).to_edge(UP)

        self.play(Create(ax), Write(formula), run_time=1.0)
        self.play(Create(limit_line), Write(limit_label), run_time=0.6)
        self.play(LaggedStart(*[FadeIn(dot) for dot in dots], lag_ratio=0.12), run_time=2.0)
        self.play(Indicate(dots[11], color=RED), run_time=0.6)
        self.wait(0.4)
