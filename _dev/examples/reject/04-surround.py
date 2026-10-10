"""surround 方法缺失

@expect 不渲染：预检应当**当场**拒绝，报错要提到「surround」并给出可读的原因或替代写法。
@reject surround
"""

from manim import *


class SurroundScene(Scene):
    def construct(self):
        circle = Circle(radius=1.5)
        square = Square(side_length=2)
        circle.surround(square)
        self.add(circle)
