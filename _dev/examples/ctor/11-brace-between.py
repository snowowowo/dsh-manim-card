"""BraceBetweenPoints 收两点

@expect 花括号撑在两点之间，方向与两点连线一致、长短与距离相称。"""

from manim import *


class BraceBetweenScene(Scene):
    def construct(self):
        brace = BraceBetweenPoints([-2, 0, 0], [2, 0, 0], color=YELLOW)
        # 两端的灰点钉住括号撑开的位置，标注写明区间
        ends = VGroup(Dot([-2, 0, 0], color=GREY), Dot([2, 0, 0], color=GREY))
        label = Text("(-2,0) → (2,0)", font_size=26)
        label.move_to([0, -1.6, 0])
        self.play(GrowFromCenter(brace), FadeIn(ends), Write(label))
        self.wait(0.3)
