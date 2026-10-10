"""CoordinateSystem：坐标系的抽象基类

@expect 不渲染：预检应当**当场**拒绝，报错要提到「CoordinateSystem」并给出可读的原因或替代写法。
@reject CoordinateSystem

@note manim-web 没有 CoordinateSystem——直接用 Axes / NumberPlane
"""

from manim import *


class CoordinateSystemScene(Scene):
    def construct(self):
        system = CoordinateSystem(x_range=[-3, 3], y_range=[-2, 2])
        self.add(system)
