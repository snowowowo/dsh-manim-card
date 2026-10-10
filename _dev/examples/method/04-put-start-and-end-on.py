"""put_start_and_end_on（Line 拆两步）

@expect 线的两端精确落在指定的两个点上。"""

from manim import *


class PutStartAndEndOnScene(Scene):
    def construct(self):
        line = Line(start=[-2, -1, 0], end=[2, 1, 0])
        line.put_start_and_end_on([-2, 1, 0], [2, -1, 0])
        self.play(Create(line))
        self.wait(0.3)
