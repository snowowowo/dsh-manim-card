"""极坐标玫瑰线

@expect 玫瑰线的花瓣数与方程参数一致（2k 瓣 / k 瓣的规律看得出来）。
@note 讲解模板：manim-web 没有 plot_polar_graph——把 r(θ) 写成参数方程交给 ParametricFunction
"""

from manim import *
import numpy as np


class PolarRoseScene(Scene):
    def construct(self):
        petals = 5

        def rose(t):
            r = 2.2 * np.cos(petals * t)
            return [r * np.cos(t), r * np.sin(t), 0]

        curve = ParametricFunction(rose, t_range=[0, TAU, 0.02], color=BLUE)
        title = MathTex(r"r = 2\cos 5\theta").to_edge(UP)

        self.play(Write(title))
        self.play(Create(curve), run_time=2)
        self.wait(0.3)
