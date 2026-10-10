"""泊松分布：稀有事件在时间轴上的到达

@expect 一条时间轴上不均匀地散落着若干次到达时刻（事件不能重叠），旁边画出计数 k 的分布柱：k=2、3 附近最高，两端迅速衰减。
@note 讲解要点：泊松过程描述「单位时间内随机到达的稀有事件」——到达是独立的、速率恒定，于是计数服从泊松分布，它的期望和方差都等于 λ。
"""

from manim import *
import math
import numpy as np


class PoissonArrivalsScene(Scene):
    def construct(self):
        lam = 2.5
        length = 10.0
        rng = np.random.default_rng(7)

        gaps = rng.exponential(1.0 / lam, size=60)
        arrivals = np.cumsum(gaps)
        # 时间窗 [0, length] 线性映到数轴 [-5, 5]
        arrivals = arrivals[arrivals < length] - 5.0

        timeline = Line([-5.0, 1.5, 0], [5.0, 1.5, 0], color=GRAY_B, stroke_width=4)
        tick_labels = VGroup()
        for i in range(11):
            x = -5.0 + i
            tick_labels.add(Line([x, 1.5, 0], [x, 1.35, 0], color=GRAY_B, stroke_width=2))
            if i % 5 == 0:
                tick_labels.add(Text(str(i), font_size=22, color=GRAY_A).move_to([x, 1.05, 0]))

        drops = VGroup(
            *[
                Line([float(t), 1.5, 0], [float(t), 0.62, 0], color=RED, stroke_width=2.5) for t in arrivals
            ]
        )
        heads = VGroup(*[Dot([float(t), 1.5, 0], radius=0.07, color=RED) for t in arrivals])

        timeline_label = Text(f"单位时间到达次数 λ = {lam} 的事件流", font_size=26, color=RED)
        timeline_label.move_to([0, 2.4, 0])

        ks = list(range(0, 9))
        pmf = [float(np.exp(-lam) * lam ** k / math.factorial(k)) for k in ks]
        peak = max(pmf)
        bars = VGroup()
        labels_k = VGroup()
        for k, p in zip(ks, pmf):
            x = -5.0 + k * 1.25
            bar = Rectangle(width=0.85, height=p / peak * 2.4, color=BLUE)
            bar.set_fill(BLUE, opacity=0.7)
            bar.move_to([x, -2.2 + p / peak * 2.4 / 2, 0])
            bars.add(bar)
            labels_k.add(Text(str(k), font_size=24, color=YELLOW).move_to([x, -2.55, 0]))

        bar_axis = Line([-5.6, -2.2, 0], [5.6, -2.2, 0], color=GRAY_B, stroke_width=2)
        bar_label = Text("计数 k 的分布", font_size=26, color=BLUE).move_to([0, 0.3, 0])

        self.play(Write(timeline_label), Create(timeline), Create(tick_labels), run_time=0.9)
        self.play(LaggedStart(*[Create(d) for d in drops], lag_ratio=0.08), run_time=1.6)
        self.play(FadeIn(heads), run_time=0.5)
        self.play(Create(bar_axis), Write(bar_label), run_time=0.7)
        self.play(LaggedStart(*[FadeIn(b) for b in bars], lag_ratio=0.1), run_time=1.4)
        self.play(Write(labels_k), run_time=0.7)
        self.wait(0.4)
