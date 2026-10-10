"""坐标轴 + 轴标签

@expect 坐标轴带箭头与 x / y 轴标签，标签贴在轴端。"""

from manim import *


class AxesLabelsScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 5, 1], y_range=[0, 5, 1])
        labels = ax.get_axis_labels(x_label="x", y_label="y")
        self.play(Create(ax))
        self.play(Write(labels))
        self.wait(0.3)
