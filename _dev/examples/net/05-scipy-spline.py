"""scipy：三次样条插值

@expect 样条曲线光滑、穿过全部数据点。
@note 插值出的曲线交给 Axes，积分值只用 print 带出来——画面上不堆文字，免得踩文本渲染
"""

from manim import *
import numpy as np
from scipy import integrate, interpolate

xs = np.array([0.0, 1.0, 2.0, 3.0, 4.0, 5.0])
ys = np.array([0.0, 1.4, 0.6, 2.2, 1.8, 3.0])
spline = interpolate.CubicSpline(xs, ys)
area = float(integrate.quad(lambda x: float(spline(x)), 0.0, 5.0)[0])
print("quad", round(area, 4))


class ScipySplineScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 5, 1], y_range=[0, 3.5, 1])
        nodes = VGroup(*[Dot(point=ax.c2p(float(xi), float(yi)), color=YELLOW) for xi, yi in zip(xs, ys)])
        curve = ax.plot(lambda x: float(spline(x)), x_range=[0, 5], color=GREEN)
        self.play(Create(ax), FadeIn(nodes))
        self.play(Create(curve))
        self.wait(0.3)
