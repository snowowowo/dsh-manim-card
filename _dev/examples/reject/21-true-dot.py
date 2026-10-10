"""TrueDot：每个子点都有独立坐标的点

@expect 不渲染：预检应当**当场**拒绝，报错要提到「TrueDot」并给出可读的原因或替代写法。
@reject TrueDot

@note manim-web 没有 TrueDot——用 Dot（或 PointCloudDot）代替
"""

from manim import *


class TrueDotScene(Scene):
    def construct(self):
        dot = TrueDot([1, 0, 0], radius=0.2)
        self.play(FadeIn(dot))
