"""LogBase：对数刻度坐标系

@expect 不渲染：预检应当**当场**拒绝，报错要提到「LogBase」并给出可读的原因或替代写法。
@reject LogBase

@note manim-web 没有 LogBase——用 Axes，坐标自己取对数
"""

from manim import *


class LogBaseScene(Scene):
    def construct(self):
        axes = LogBase(base=10, x_range=[1, 1000])
        self.add(axes)
