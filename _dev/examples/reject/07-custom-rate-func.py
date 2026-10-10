"""自定义速率函数

@expect 不渲染：预检应当**当场**拒绝，报错要提到「rate_func」并给出可读的原因或替代写法。
@reject rate_func

@note Python 函数过不了桥——宁可当场说清，也不要静默失效
"""

from manim import *


class CustomRateFuncScene(Scene):
    def construct(self):
        circle = Circle(radius=1.2)
        self.play(Create(circle), rate_func=lambda t: t)
