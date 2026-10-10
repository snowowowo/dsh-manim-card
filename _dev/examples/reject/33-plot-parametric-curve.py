"""Axes.plot_parametric_curve：按参数方程画曲线

@expect 不渲染：预检应当**当场**拒绝，报错要提到「plot_parametric_curve」并给出可读的原因或替代写法。
@reject plot_parametric_curve

@note manim-web 的 Axes 没有它——改用 ParametricFunction（把参数方程写成函数）
"""

from manim import *


class PlotParametricScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 7], y_range=[-2, 2])
        curve = ax.plot_parametric_curve(lambda t: [t, np.sin(t), 0], t_range=[0, 7])
        self.add(ax, curve)
