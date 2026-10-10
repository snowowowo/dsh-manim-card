"""傅里叶级数逼近方波

@expect 一条方波（台阶状）与四条部分和曲线叠在一起：项数越多，平坦段越平、跳变处越陡，
        但跳变点附近始终有一个小过冲（吉布斯现象）。
@note 讲解要点：用正弦波叠出方波，需要无穷多项；有限项一定会「振铃」。
    部分和由 numpy 直接算好再交给 plot_line_graph——比在 lambda 里逐点求和快得多，也更稳。
"""

from manim import *
import numpy as np


class FourierSquareScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[-PI, PI, PI / 2],
            y_range=[-1.8, 1.8, 1],
            x_length=8.4,
            y_length=3.6,
            tips=False,
            axis_config={"color": GRAY_B},
        )
        xs = np.linspace(-np.pi, np.pi, 240)
        square = np.sign(np.sin(xs))
        square[square == 0] = 1.0

        square_graph = ax.plot_line_graph(xs, square, add_vertex_dots=False, line_color=GRAY_B)
        partials = VGroup()
        for terms, color in [(1, BLUE), (3, TEAL), (9, GREEN), (25, YELLOW)]:
            ys = np.zeros_like(xs)
            for k in range(1, terms + 1, 2):
                ys += (4 / np.pi) * np.sin(k * xs) / k
            partials.add(ax.plot_line_graph(xs, ys, add_vertex_dots=False, line_color=color))

        note = Text("项数 1 → 3 → 9 → 25", font_size=26, color=WHITE).to_edge(DOWN, buff=0.35)
        title = MathTex(r"\frac{4}{\pi}\sum_{k\ \text{odd}}\frac{\sin kx}{k}", font_size=42).to_edge(UP)

        self.play(Create(ax), Create(square_graph), run_time=1.0)
        self.play(Write(title), run_time=0.8)
        for curve in partials:
            self.play(Create(curve), run_time=0.8)
        self.play(Write(note), run_time=0.5)
        self.wait(0.5)
