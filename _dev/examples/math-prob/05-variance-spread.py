"""方差刻画离散程度：同期望，不同「撒得开」

@expect 上下一共两组数据共享同一条数轴和同一个均值刻度，但一组的点挤成一撮、另一组散得很开；两条两端带短竖线端点标记的横线标出各自的极差，视觉差距直接对应方差 2 与 200。
@note 讲解要点：均值只告诉你「重心在哪」，完全说不出「有多散」——两组数据 μ 都是 50，却是完全不同的两个分布。方差就是把这个「散」量化出来的量。
"""

from manim import *


class VarianceSpreadScene(Scene):
    def construct(self):
        group_a = [48, 49, 50, 51, 52]
        group_b = [30, 40, 50, 60, 70]
        x_of = lambda v: -5.0 + (v - 20) / 6.0

        axis = NumberLine(
            x_range=[20, 80, 10],
            length=10.0,
            include_numbers=True,
            color=GRAY_B,
        )
        mean_line = Line([0, -2.4, 0], [0, 2.4, 0], color=RED, stroke_width=3)

        dots_a = VGroup(*[Dot([x_of(v), 1.7, 0], radius=0.11, color=BLUE) for v in group_a])
        dots_b = VGroup(*[Dot([x_of(v), -1.7, 0], radius=0.11, color=YELLOW) for v in group_b])

        def span_line(x1, x2, y, color):
            bar = Line([x1, y, 0], [x2, y, 0], color=color, stroke_width=4)
            cap_l = Line([x1, y - 0.14, 0], [x1, y + 0.14, 0], color=color, stroke_width=4)
            cap_r = Line([x2, y - 0.14, 0], [x2, y + 0.14, 0], color=color, stroke_width=4)
            return VGroup(bar, cap_l, cap_r)

        span_a = span_line(x_of(48), x_of(52), 2.5, BLUE)
        span_b = span_line(x_of(30), x_of(70), -2.5, YELLOW)

        txt = lambda s, c=WHITE, fs=26: Text(s, font_size=fs, color=c)
        labels = VGroup(
            txt("μ = 50（同一个重心）", RED, 24).next_to(mean_line, UP, buff=0.1).shift(RIGHT * 2.2),
            txt("A：48~52，σ² = 2", BLUE, 24).move_to([x_of(48) + 0.2, 3.1, 0]),
            txt("B：30~70，σ² = 200", YELLOW, 24).move_to([x_of(70) - 1.0, -3.1, 0]),
        )

        title = txt("期望只看重心，方差才看「散得多开」", GRAY_A, 28).to_edge(UP, buff=0.3)

        self.play(Write(title), run_time=0.7)
        self.play(Create(axis), run_time=0.7)
        self.play(FadeIn(dots_a), Create(span_a), Write(labels[1]), run_time=1.0)
        self.play(Create(mean_line), Write(labels[0]), run_time=0.8)
        self.play(FadeIn(dots_b), Create(span_b), Write(labels[2]), run_time=1.0)
        self.wait(0.4)
