"""数轴 + 数字

@expect 一条数轴，刻度与刻度数字对得上、间距均匀。"""

from manim import *


class NumberLineScene(Scene):
    def construct(self):
        line = NumberLine(x_range=[-4, 4, 1], include_numbers=True)
        self.play(Create(line))
        self.wait(0.3)
