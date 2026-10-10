"""arrange_in_grid

@expect 一组物体排成整齐的网格，行列数与间距按参数。
@note CE 只有一个 buff，manim-web 拆成 buffX / buffY 两个位置参数
"""

from manim import *


class ArrangeGridScene(Scene):
    def construct(self):
        dots = VGroup(*[Dot(radius=0.15) for _ in range(4)])
        dots.arrange_in_grid(rows=2, cols=2, buff=0.8)
        self.play(FadeIn(dots))
        self.wait(0.3)
