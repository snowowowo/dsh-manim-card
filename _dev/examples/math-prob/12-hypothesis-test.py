"""假设检验的两类错误：α 是弃真，β 是取伪

@expect 两条错开的钟形曲线分别代表原假设 H0 与备择假设 H1；H0 右尾被切出红线区（弃真 / 假阳性），H1 左尾被切出黄线区（取伪 / 假阴性），中间那道竖线就是拒绝域的门槛。
@note 讲解要点：门槛往右移，弃真概率 α 变小、但取伪概率 β 变大；两者此消彼长，不可能同时压到最低。只有加大样本量让两条曲线变瘦，才能同时把 α 和 β 都收小。
"""

from manim import *
import numpy as np


class HypothesisTestScene(Scene):
    def construct(self):
        pdf = lambda x, mu: np.exp(-(x - mu) ** 2 / (2 * 0.55 ** 2)) / (0.55 * np.sqrt(2 * np.pi))

        ax = Axes(
            x_range=[-3, 5, 1],
            y_range=[0, 0.8, 0.2],
            x_length=10.5,
            y_length=3.4,
            tips=False,
            axis_config={"color": GRAY_B},
        )
        ax.shift(DOWN * 0.35)

        critical = 1.1
        h0_mu = 0.0
        h1_mu = 2.3

        curve_h0 = ax.plot(lambda t: float(pdf(t, h0_mu)), x_range=[-3, 4.2], color=BLUE)
        curve_h1 = ax.plot(lambda t: float(pdf(t, h1_mu)), x_range=[-1.2, 5], color=GREEN)

        bar_span = (critical + 4.2) - critical
        bar_w = bar_span / 40.0
        alpha_bars = VGroup()
        for i in range(40):
            x = critical + bar_w * (i + 0.5)
            y_low = ax.c2p(0, 0)[1]
            y_high = ax.c2p(0, float(pdf(x, h0_mu)))[1]
            if abs(y_high - y_low) < 1e-6:
                continue
            bar = Rectangle(width=abs(ax.c2p(bar_w, 0)[0] - ax.c2p(0, 0)[0]), height=y_high - y_low, color=RED)
            bar.set_fill(RED, opacity=0.85)
            bar.move_to([ax.c2p(x, 0)[0], (y_low + y_high) / 2, 0])
            alpha_bars.add(bar)

        beta_bars = VGroup()
        for i in range(40):
            x = critical - bar_w * (i + 0.5)
            y_low = ax.c2p(0, 0)[1]
            y_high = ax.c2p(0, float(pdf(x, h1_mu)))[1]
            if abs(y_high - y_low) < 1e-6:
                continue
            bar = Rectangle(width=abs(ax.c2p(bar_w, 0)[0] - ax.c2p(0, 0)[0]), height=y_high - y_low, color=YELLOW)
            bar.set_fill(YELLOW, opacity=0.85)
            bar.move_to([ax.c2p(x, 0)[0], (y_low + y_high) / 2, 0])
            beta_bars.add(bar)

        gate = Line(ax.c2p(critical, 0), ax.c2p(critical, 0.72), color=WHITE, stroke_width=3)
        gate_label = Text("拒绝域门槛", font_size=24, color=WHITE).next_to(gate, UP, buff=0.12)

        labels = VGroup(
            Text("H0 成立时的分布", font_size=26, color=BLUE).move_to([ax.c2p(-2.3, 0)[0], 2.9, 0]),
            Text("H1 成立时的分布", font_size=26, color=GREEN).move_to([ax.c2p(3.4, 0)[0], 2.0, 0]),
            Text("α：弃真（假阳性）", font_size=24, color=RED).move_to([ax.c2p(2.6, 0)[0], 1.0, 0]),
            Text("β：取伪（假阴性）", font_size=24, color=YELLOW).move_to([ax.c2p(-0.7, 0)[0], -2.6, 0]),
        )

        title = Text("两类错误此消彼长：门槛一动，α 与 β 一个减小一个变大", font_size=28)
        title.to_edge(UP, buff=0.3)

        self.play(Write(title), Create(ax), run_time=0.8)
        self.play(Create(curve_h0), Create(curve_h1), run_time=1.4)
        self.play(Write(labels[0]), Write(labels[1]), run_time=0.7)
        self.play(Create(gate), Write(gate_label), run_time=0.6)
        self.play(FadeIn(alpha_bars), Write(labels[2]), run_time=0.9)
        self.play(FadeIn(beta_bars), Write(labels[3]), run_time=0.9)
        self.wait(0.4)
