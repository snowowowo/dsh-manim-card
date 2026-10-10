"""ParametricFunction 位置参数

@expect 按参数方程画出的曲线，形状与参数方程一致（不是圆也不是直线）。
@note 2026-10-09 事故：同上报「位置参数暂不支持」；func 是 Python 函数
"""

from manim import *


class ParametricScene(Scene):
    def construct(self):
        curve = ParametricFunction(lambda t: [t, np.sin(t), 0], t_range=[-3, 3, 0.2], color=PURPLE)
        self.play(Create(curve))
        self.wait(0.3)
