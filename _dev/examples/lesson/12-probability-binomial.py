"""概率：二项分布

@expect 两组二项分布 pmf 折线并排：n=10 峰值约 0.25、n=30 峰值约 0.14——
        同样的 p，n 越大分布越矮越宽，「参数决定胖瘦」靠两组对照成立。
@note 讲解模板：n 次试验成功 k 次的概率——p 相同、n 不同，两组折线对照着看；
      BarChart 默认摆位偏右上且宽度不受 x_length 约束、两组会重叠出框，
      降级用 Axes.plot_line_graph 左右各占半幅；
      "p = 0.5" 里的 p 斜体字形易缺字，标题一律用 Text 不用 MathTex
"""

from manim import *
import math


class BinomialScene(Scene):
    def construct(self):
        ks_10 = list(range(11))
        pmf_10 = [math.comb(10, k) * 0.5 ** 10 for k in ks_10]
        ks_30 = list(range(31))
        pmf_30 = [math.comb(30, k) * 0.5 ** 30 for k in ks_30]

        ax_10 = Axes(
            x_range=[0, 10, 2],
            y_range=[0, 0.3, 0.1],
            x_length=5.2,
            y_length=3.2,
            tips=False,
            axis_config={"color": GRAY_B},
        )
        ax_10.move_to([-3.5, -0.7, 0])
        graph_10 = ax_10.plot_line_graph(ks_10, pmf_10, add_vertex_dots=True,
                                         line_color=GREEN, vertex_dot_radius=0.04)

        ax_30 = Axes(
            x_range=[0, 30, 10],
            y_range=[0, 0.3, 0.1],
            x_length=5.2,
            y_length=3.2,
            tips=False,
            axis_config={"color": GRAY_B},
        )
        ax_30.move_to([3.5, -0.7, 0])
        graph_30 = ax_30.plot_line_graph(ks_30, pmf_30, add_vertex_dots=True,
                                         line_color=TEAL, vertex_dot_radius=0.04)

        label_10 = Text("n=10", font_size=28, color=GREEN).move_to([-3.5, 1.5, 0])
        label_30 = Text("n=30", font_size=28, color=TEAL).move_to([3.5, 1.5, 0])
        title = Text("p = 0.5：参数决定分布的胖瘦", font_size=32).move_to([0, 3.4, 0])

        self.play(Write(title))
        self.play(Create(ax_10), Create(graph_10), Write(label_10), run_time=1.2)
        self.play(Create(ax_30), Create(graph_30), Write(label_30), run_time=1.2)
        self.wait(0.3)
