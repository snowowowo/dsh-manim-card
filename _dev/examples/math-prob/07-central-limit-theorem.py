"""中心极限定理：独立同分布求和，分布形状必然向正态靠拢

@expect 三个并排直方图，从左到右分别是一颗骰子（平的）、两颗之和（三角形）、四颗之和（明显钟形）；右侧两张的柱子朝中间堆、两端塌下去，且被归一化成同高以便比较形状。
@note 讲解要点：单颗骰子是完全均匀的，一点都不「正态」；但只要把若干独立同分布的变量加起来，中心就会长出钟形——不管原来是什么分布。这是正态分布无处不在的根源。
"""

from manim import *
import numpy as np


class CentralLimitScene(Scene):
    def construct(self):
        rng = np.random.default_rng(2026)
        samples = 20000

        def heights_for(k):
            rolls = rng.integers(1, 7, size=(samples, k)).sum(axis=1).tolist()
            counts = [0] * (6 * k - k + 1)
            for value in rolls:
                counts[value - k] += 1
            peak = max(counts)
            return [c / peak for c in counts]

        def make_panel(k, center, color):
            hs = heights_for(k)
            span = 3.5
            slot = span / len(hs)
            bars = VGroup()
            for i, h in enumerate(hs):
                bar = Rectangle(width=slot * 0.82, height=float(h) * 2.0, color=color)
                bar.set_fill(color, opacity=0.7)
                bar.move_to([center - span / 2 + slot * (i + 0.5), -1.4 + float(h), 0])
                bars.add(bar)
            return bars

        panel_cfg = [(1, -4.6, BLUE, "1 颗骰子"), (2, 0.0, GREEN, "2 颗相加"), (4, 4.6, YELLOW, "4 颗相加")]
        bars_all = VGroup()
        titles = VGroup()
        for k, center, color, name in panel_cfg:
            bars_all.add(make_panel(k, center, color))
            titles.add(Text(name, font_size=26, color=color).move_to([center, 0.95, 0]))

        baseline = VGroup(
            *[Line([c - 1.75, -1.4, 0], [c + 1.75, -1.4, 0], color=GRAY_B, stroke_width=2) for _, c, _, _ in panel_cfg]
        )

        title = Text("中心极限定理：求和之后，形状自己长成钟形", font_size=30).to_edge(UP, buff=0.35)
        caption = Text(
            "原来均匀 / 三角形都无所谓，加得越多越像正态",
            font_size=26,
            color=GRAY_A,
        ).to_edge(DOWN, buff=0.35)

        self.play(Write(title), Create(baseline), run_time=0.8)
        self.play(LaggedStart(*[FadeIn(p) for p in bars_all], lag_ratio=0.25), run_time=2.0)
        self.play(Write(titles), run_time=0.8)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
