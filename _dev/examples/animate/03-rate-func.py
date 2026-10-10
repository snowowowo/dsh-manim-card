"""速率与时长

@expect 同一段位移按给定的 run_time 走完：急缓由速率决定、快慢由时长决定，肉眼可分。"""

from manim import *


class RateFuncScene(Scene):
    def construct(self):
        circle = Circle(radius=1.2)
        self.play(Create(circle), rate_func=smooth, run_time=1.5)
        self.wait(0.3)
