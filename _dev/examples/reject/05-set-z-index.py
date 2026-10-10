"""set_z_index 方法缺失

@expect 不渲染：预检应当**当场**拒绝，报错要提到「set_z_index」并给出可读的原因或替代写法。
@reject set_z_index
"""

from manim import *


class SetZIndexScene(Scene):
    def construct(self):
        circle = Circle(radius=1.5)
        circle.set_z_index(2)
        self.add(circle)
