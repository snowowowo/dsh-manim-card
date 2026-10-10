"""VGroup + 下标取子物体

@expect 下标取出的子物体单独被操作，越界下标抛 IndexError（print 断言为准）。"""

from manim import *


class VgroupIndexScene(Scene):
    def construct(self):
        dots = VGroup(*[Dot(point=[i - 2, 0, 0]) for i in range(5)])
        self.play(FadeIn(dots))
        self.play(dots[0].animate.set_color(RED))
        self.wait(0.3)
