"""squish_rate_func：把速率函数压进一段子区间

@expect 不渲染：预检应当**当场**拒绝，报错要提到「squish_rate_func」并给出可读的原因或替代写法。
@reject squish_rate_func

@note manim-web 只认清单里的速率名——节奏用 run_time 与多段 play 控
"""

from manim import *


class SquishRateFuncScene(Scene):
    def construct(self):
        circle = Circle(radius=1.2)
        self.play(Create(circle), rate_func=squish_rate_func(smooth, 0.3, 0.7))
