"""坐标轴 + 轴标签

@expect 坐标轴带箭头与 x / y 轴标签，标签贴在轴端。"""

from manim import *


class AxesLabelsScene(Scene):
    def construct(self):
        # 对称范围让原点居中，不缩在角落
        ax = Axes(x_range=[-4, 4, 1], y_range=[-2, 2, 1])
        labels = ax.get_axis_labels(x_label="x", y_label="y")
        self.play(Create(ax))
        self.play(Write(labels))
        self.wait(0.3)
