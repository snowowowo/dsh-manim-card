"""正态分布的 3σ 法则：钟形曲线下的面积怎么分

@expect 钟形曲线下方用虚线切出 ±1σ、±2σ、±3σ 三道关口，右侧列出各自覆盖的面积；下方 1000 次抽样的小点密密麻麻挤在中间，落在 ±2.5σ 之外的少数几个被染红。
@note 讲解要点：68.3% / 95.4% / 99.7% 说的是「概率集中在中心」，不是「值域到此为止」——尾巴永远存在，只是以小概率存在，所以 3σ 外的事件叫「小概率」而不叫「不可能」。
"""

from manim import *
import numpy as np


class NormalSigmaScene(Scene):
    def construct(self):
        rng = np.random.default_rng(31)
        pdf = lambda x: np.exp(-x * x / 2.0) / np.sqrt(2.0 * np.pi)

        ax = Axes(
            x_range=[-4, 4, 1],
            y_range=[0, 0.5, 0.1],
            x_length=11.0,
            y_length=2.4,
            tips=False,
            axis_config={"color": GRAY_B},
        )
        ax.shift(UP * 1.55)

        curve = ax.plot(lambda t: float(pdf(t)), x_range=[-4, 4], color=BLUE)

        gates = VGroup()
        for sigma, color in [(1.0, GREEN), (2.0, YELLOW), (3.0, RED)]:
            for sign in (-1, 1):
                gates.add(
                    DashedLine(
                        ax.c2p(sign * sigma, 0),
                        ax.c2p(sign * sigma, 0.42),
                        color=color,
                        stroke_width=2,
                    )
                )

        label_rows = VGroup(
            Text("±1σ → 68.3%", font_size=24, color=GREEN).move_to([5.55, 0.55, 0]),
            Text("±2σ → 95.4%", font_size=24, color=YELLOW).move_to([5.55, 0.05, 0]),
            Text("±3σ → 99.7%", font_size=24, color=RED).move_to([5.55, -0.45, 0]),
        )

        raw = rng.normal(0.0, 1.0, size=1000)
        ys = rng.uniform(-2.5, -1.35, size=1000)
        inside = VGroup()
        outside = VGroup()
        for value, y in zip(raw, ys):
            # 抽样点的 x 要过 c2p 换算，才和上方曲线同一个比例
            px = ax.c2p(float(value), 0)[0]
            if abs(value) > 2.5:
                outside.add(Dot([px, float(y), 0], radius=0.035, color=RED))
            else:
                inside.add(Dot([px, float(y), 0], radius=0.035, color=TEAL))

        sample_note = Text("1000 次抽样：落在 ±2.5σ 之外的只有极少数", font_size=26, color=GRAY_A)
        sample_note.move_to([0, -0.95, 0])

        title = Text("正态分布的 3σ 法则", font_size=30).to_edge(UP, buff=0.3)
        caption = Text("尾巴不是 0，只是极小——小概率 ≠ 不可能", font_size=26, color=GRAY_A)
        caption.to_edge(DOWN, buff=0.3)

        self.play(Write(title), Create(ax), run_time=0.8)
        self.play(Create(curve), run_time=1.2)
        self.play(Create(gates), Write(label_rows), run_time=1.0)
        self.play(LaggedStart(*[FadeIn(d) for d in inside], lag_ratio=0.002), run_time=1.6)
        self.play(FadeIn(outside), Write(sample_note), run_time=0.8)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
