"""大数定律：频率随试验次数增加而贴向真实概率

@expect 一条从剧烈上下抖动开始、越往右摆幅越小的折线，逐渐收拢到 y=0.5 那条理论概率的虚线上——收敛是「以概率 1」的，不是每一步都单调靠近。
@note 讲解要点：折线在左侧跳得厉害并不代表不公平；大数定律说的是 n 趋于无穷时频率依概率收敛到 p。前几步的偏差会被庞大的分母稀释掉。
"""

from manim import *
import numpy as np


class LawOfLargeNumbersScene(Scene):
    def construct(self):
        rng = np.random.default_rng(2024)
        n_max = 400
        flips = (rng.random(n_max) < 0.5).astype(float)
        freq = np.cumsum(flips) / np.arange(1, n_max + 1)

        ax = Axes(
            x_range=[0, 400, 100],
            y_range=[0, 1, 0.25],
            x_length=9.5,
            y_length=4.2,
            tips=False,
            axis_config={"color": GRAY_B},
        )
        ax.shift(DOWN * 0.9)

        true_line = DashedLine(ax.c2p(0, 0.5), ax.c2p(400, 0.5), color=RED)
        true_label = Text("真实概率 p = 0.5", font_size=26, color=RED)
        true_label.next_to(true_line, UP, buff=0.12).align_to(true_line, RIGHT)

        step = 5
        pts = [ax.c2p(n, float(freq[n - 1])) for n in range(step, n_max + 1, step)]
        path = VGroup(
            *[Line(pts[i], pts[i + 1], color=YELLOW, stroke_width=2.5) for i in range(len(pts) - 1)]
        )

        start_mark = Dot(pts[0], radius=0.07, color=BLUE)
        end_mark = Dot(pts[-1], radius=0.09, color=GREEN)

        title = Text("大数定律：n 越大，频率越贴住 p", font_size=30).to_edge(UP, buff=0.35)
        caption = Text("左边抖得厉害只是分母小，不是硬币有问题", font_size=26, color=GRAY_A)
        caption.to_edge(DOWN, buff=0.35)

        self.play(Create(ax), Write(title), run_time=1.0)
        self.play(Create(true_line), Write(true_label), run_time=0.6)
        self.play(Create(path), FadeIn(start_mark), run_time=2.4, rate_func=linear)
        self.play(FadeIn(end_mark), run_time=0.4)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
