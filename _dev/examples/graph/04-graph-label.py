"""曲线加标签

@expect 曲线旁边贴着它的标签，不出画、不压线。"""

from manim import *


class GraphLabelScene(Scene):
    def construct(self):
        ax = Axes(x_range=[-3, 3, 1], y_range=[-1, 4, 1])
        graph = ax.plot(lambda x: x * x / 3, color=GREEN)
        label = ax.get_graph_label(graph, "x^2/3")
        self.play(Create(ax), Create(graph))
        self.play(Write(label))
        self.wait(0.3)
