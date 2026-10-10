"""坐标系 + 函数曲线

@expect 一套坐标系上画出函数曲线，曲线走势与函数一致、贴着坐标刻度。
@note plot() 的 func 是 Python 函数——要过桥，见「构造器参数」组的同项
"""

from manim import *


class AxesPlotScene(Scene):
    def construct(self):
        ax = Axes(x_range=[-3, 3, 1], y_range=[-1, 3, 1])
        graph = ax.plot(lambda x: x * x / 3, color=GREEN)
        self.play(Create(ax), Create(graph))
        self.wait(0.3)
