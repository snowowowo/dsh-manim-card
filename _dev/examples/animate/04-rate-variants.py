"""there_and_back 速率

@expect 物体走到目标后又原路折返回起点（there_and_back 的标志性行为）。
@note rate_func 传的是速率**名**（字符串），自定义函数过不了桥
"""

from manim import *


class RateVariantsScene(Scene):
    def construct(self):
        circle = Circle(radius=1.2, color=BLUE)
        self.play(Create(circle))
        self.play(circle.animate.shift(RIGHT * 3), rate_func=there_and_back, run_time=2)
        self.wait(0.3)
