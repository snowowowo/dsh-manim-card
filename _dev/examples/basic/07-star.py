"""六角星

@expect 一个五角星轮廓，五个尖角清晰。"""

from manim import *


class StarScene(Scene):
    def construct(self):
        star = Star(n=6, outer_radius=1.5, color=GOLD)
        self.play(Create(star))
        self.wait(0.3)
