"""柱状图

@expect 几根柱子高低与数据一致、间距均匀。"""

from manim import *


class BarChartScene(Scene):
    def construct(self):
        chart = BarChart(values=[1, 3, 2], bar_colors=[RED, BLUE, GREEN])
        self.play(Create(chart))
        self.wait(0.3)
