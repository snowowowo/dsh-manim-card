"""阿基米德螺线

@expect 螺线一圈圈等距外扩，圈距恒定（阿基米德螺线的特征）。
@note 讲解模板：r 随 θ 线性增长，同样用参数方程画
"""

from manim import *
import numpy as np


class PolarSpiralScene(Scene):
    def construct(self):
        def spiral(t):
            r = 0.35 * t
            return [r * np.cos(t), r * np.sin(t), 0]

        curve = ParametricFunction(spiral, t_range=[0, TAU * 2, 0.02], color=TEAL)
        title = MathTex(r"r = \theta").to_edge(UP)

        self.play(Write(title))
        self.play(Create(curve), run_time=2)
        self.wait(0.3)
