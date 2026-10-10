"""Point：只画一个点

@expect 不渲染：预检应当**当场**拒绝，报错要提到「Point」并给出可读的原因或替代写法。
@reject Point

@note manim-web 没有 Point——用 Dot(radius=...) 代替
"""

from manim import *


class PointScene(Scene):
    def construct(self):
        point = Point([1, 1, 0])
        self.add(point)
