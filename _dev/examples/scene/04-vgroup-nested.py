"""VGroup 套 VGroup

@expect 嵌套组整体动、子组也单独动，两层互不串。"""

from manim import *


class VgroupNestedScene(Scene):
    def construct(self):
        inner = VGroup(Circle(radius=0.4), Square(side_length=0.6))
        inner.arrange(RIGHT, buff=0.3)
        outer = VGroup(inner, Dot(point=[0, -1.5, 0], color=RED))
        self.play(FadeIn(outer))
        self.wait(0.3)
