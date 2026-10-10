"""部分和：调和级数发散 vs Σ1/n² 收敛

@expect 蓝线（调和级数部分和）一路上爬、看不到头；黄线（1/n² 部分和）很快压平并停住。
@note 讲解要点：通项都趋于 0，但一个收敛一个发散——「通项趋于 0」只是必要条件。
    两条都用 plot_line_graph 画在 n 上，横轴就是项数。
"""

from manim import *
import numpy as np


class SeriesPartialSumScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[0, 16, 4],
            y_range=[0, 3.6, 1],
            x_length=8.4,
            y_length=3.6,
            tips=False,
            axis_config={"color": GRAY_B},
        )
        ns = np.arange(1, 16)
        harmonic = np.cumsum(1.0 / ns)
        quadratic = np.cumsum(1.0 / ns ** 2)

        harmonic_graph = ax.plot_line_graph(ns, harmonic, add_vertex_dots=True,
                                            line_color=BLUE, vertex_dot_radius=0.04)
        quadratic_graph = ax.plot_line_graph(ns, quadratic, add_vertex_dots=True,
                                            line_color=YELLOW, vertex_dot_radius=0.04)

        labels = VGroup(
            MathTex(r"\sum_{n=1}^{N}\frac{1}{n} \to \infty", color=BLUE, font_size=36).move_to([-3.2, 3.05, 0]),
            MathTex(r"\sum_{n=1}^{\infty}\frac{1}{n^2} = \frac{\pi^2}{6}", color=YELLOW, font_size=36).move_to([3.5, 3.05, 0]),
        )
        axis_labels = ax.get_axis_labels(x_label="N", y_label="S_N")

        self.play(Create(ax), Write(axis_labels), run_time=1.0)
        self.play(Write(labels[1]), Create(quadratic_graph), run_time=1.2)
        self.play(Write(labels[0]), Create(harmonic_graph), run_time=1.5)
        self.wait(0.4)
