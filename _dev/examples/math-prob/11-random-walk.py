"""随机游走：每一步无记忆，但整体呈现出 √n 的尺度

@expect 四条独立的一维随机游走轨迹同时从原点出发，各自上下乱走、互不同步；终点被标出，包围它们的横向包络宽度远小于步数——典型量级是 √n 而不是 n。
@note 讲解要点：每一步的期望位移是 0，所以游走不会「漂」到某一边；但方差逐步累加，标准差按 √n 增长。这正是「无偏但不确定」的标准图像，也是扩散方程与布朗运动的离散原型。
"""

from manim import *
import numpy as np


class RandomWalkScene(Scene):
    def construct(self):
        rng = np.random.default_rng(1234)
        steps = 300
        colors = [BLUE, YELLOW, GREEN, TEAL]

        ax = Axes(
            x_range=[0, 300, 100],
            y_range=[-30, 30, 15],
            x_length=9.5,
            y_length=4.6,
            tips=False,
            axis_config={"color": GRAY_B},
        )
        ax.shift(DOWN * 0.6)

        zero_line = DashedLine(ax.c2p(0, 0), ax.c2p(300, 0), color=GRAY_B, stroke_width=2)

        walks = VGroup()
        ends = VGroup()
        legend = VGroup()
        for idx, color in enumerate(colors):
            moves = rng.choice([-1.0, 1.0], size=steps)
            path_values = np.concatenate([[0.0], np.cumsum(moves)])
            pts = [ax.c2p(int(i), float(v)) for i, v in enumerate(path_values)]
            walks.add(
                VGroup(*[Line(pts[i], pts[i + 1], color=color, stroke_width=2) for i in range(len(pts) - 1)])
            )
            ends.add(Dot(pts[-1], radius=0.08, color=color))
            legend.add(Text(f"第 {idx + 1} 条", font_size=22, color=color).move_to([4.4, 2.6 - idx * 0.45, 0]))

        sigma_note = MathTex(r"\text{std}(S_n) = \sqrt{n} \approx 17.3", font_size=40, color=RED)
        sigma_note.move_to([-3.9, -2.4, 0])
        formula = MathTex(r"S_n = X_1 + X_2 + \cdots + X_n,\quad E[X_i] = 0", font_size=40)
        formula.to_edge(UP, buff=0.35)
        caption = Text("期望停在 0，但幅度按 √n 长——无偏，却越来越说不准", font_size=26, color=GRAY_A)
        caption.to_edge(DOWN, buff=0.3)

        self.play(Write(formula), run_time=0.8)
        self.play(Create(ax), Create(zero_line), run_time=0.9)
        self.play(LaggedStart(*[Create(w) for w in walks], lag_ratio=0.3), run_time=3.0)
        self.play(FadeIn(ends), Write(legend), run_time=0.7)
        self.play(Write(sigma_note), run_time=0.7)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
