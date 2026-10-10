"""BraceBetweenPoints 收两点

@expect 花括号撑在两点之间，方向与两点连线一致、长短与距离相称。"""

from manim import *


class BraceBetweenScene(Scene):
    def construct(self):
        brace = BraceBetweenPoints([-2, 0, 0], [2, 0, 0], color=YELLOW)
        self.play(GrowFromCenter(brace))
        self.wait(0.3)
