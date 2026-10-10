"""Axes.plot_derivative_graph：画导函数图像

@expect 不渲染：预检应当**当场**拒绝，报错要提到「plot_derivative_graph」并给出可读的原因或替代写法。
@reject plot_derivative_graph

@note manim-web 的 Axes 没有它——自己求导，再用 ax.plot(导函数)
"""

from manim import *


class PlotDerivativeScene(Scene):
    def construct(self):
        ax = Axes(x_range=[-3, 3], y_range=[-2, 9])
        graph = ax.plot(lambda x: x ** 2, color=BLUE)
        derivative = ax.plot_derivative_graph(graph)
        self.add(ax, graph, derivative)
