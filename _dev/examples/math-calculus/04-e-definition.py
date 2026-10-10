"""e 的定义：(1+1/n)^n 单调递增趋近 e

@expect 点列随 n 增大一路单调上升、并且始终待在那条 y=e 的虚线下面。
@note 讲解要点：与 1+1/n 那组对照着看——那组从上面压下来、这组从下面顶上去，两条都收敛，这就是 e。
    用 DecimalNumber 把 n 与当前值显示出来，比只看点更有说服力。
"""

from manim import *
import numpy as np


class EDefinitionScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[0, 12, 2],
            y_range=[0, 3.2, 1],
            x_length=8.0,
            y_length=3.4,
            tips=False,
            axis_config={"color": GRAY_B},
        )
        ax.shift(DOWN * 0.8)

        e_line = DashedLine(ax.c2p(0, np.e), ax.c2p(12, np.e), color=RED)
        e_label = MathTex(r"e \approx 2.718", color=RED, font_size=34).next_to(e_line, RIGHT, buff=0.15)
        dots = VGroup(*[Dot(ax.c2p(n, (1 + 1 / n) ** n), radius=0.06, color=YELLOW) for n in range(1, 13)])
        formula = MathTex(r"a_n = \left(1 + \frac{1}{n}\right)^n", font_size=44).to_edge(UP)

        self.play(Create(ax), Write(formula), run_time=1.0)
        self.play(Create(e_line), Write(e_label), run_time=0.6)
        self.play(LaggedStart(*[FadeIn(dot) for dot in dots], lag_ratio=0.12), run_time=2.0)
        self.play(Indicate(dots[11], color=RED), run_time=0.6)
        self.wait(0.4)
