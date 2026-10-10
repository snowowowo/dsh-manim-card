"""scipy：求根并标在曲线上

@expect 求出的根标在曲线与 x 轴的交点上，位置对得上。
@note scipy 会连 openblas 一起取，是这批里最重的一个——所以更该有它一条真用例
"""

from manim import *
from scipy.optimize import brentq

root = float(brentq(lambda x: x**3 - 2 * x - 5, 2.0, 3.0))
print("brentq", round(root, 6))


class ScipyRootScene(Scene):
    def construct(self):
        ax = Axes(x_range=[-1.5, 3.5, 1], y_range=[-8, 8, 4])
        graph = ax.plot(lambda x: x**3 - 2 * x - 5, x_range=[-1.2, 3.2], color=BLUE)
        dot = Dot(point=ax.c2p(root, 0.0), color=YELLOW)
        self.play(Create(ax), Create(graph))
        self.play(FadeIn(dot))
        self.wait(0.3)
