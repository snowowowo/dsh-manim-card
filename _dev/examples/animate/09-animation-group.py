"""AnimationGroup 并行

@expect 组里的几个动画同时进行、同时结束，不逐个来。"""

from manim import *


class AnimationGroupScene(Scene):
    def construct(self):
        c = Circle(radius=1)
        s = Square(side_length=2, color=YELLOW).shift(RIGHT * 3)
        self.play(AnimationGroup(Create(c), Create(s), lag_ratio=0.5))
        self.wait(0.3)
