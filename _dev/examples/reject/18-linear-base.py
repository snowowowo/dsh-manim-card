"""LinearBase：线性刻度坐标系的抽象基类

@expect 不渲染：预检应当**当场**拒绝，报错要提到「LinearBase」并给出可读的原因或替代写法。
@reject LinearBase

@note manim-web 没有 LinearBase——直接用 Axes（它本身就是线性刻度）
"""

from manim import *


class LinearBaseScene(Scene):
    def construct(self):
        axes = LinearBase(x_range=[-4, 4], y_range=[-2, 2])
        self.add(axes)
