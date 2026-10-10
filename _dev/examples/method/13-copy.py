"""copy 出新物体

@expect 副本改动后原件不动——两者独立，不串样式。"""

from manim import *


class CopyScene(Scene):
    def construct(self):
        circle = Circle(radius=1, color=BLUE)
        copy = circle.copy()
        copy.shift(RIGHT * 3).set_color(GREEN)
        self.play(Create(circle), Create(copy))
        self.wait(0.3)
