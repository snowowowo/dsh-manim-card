"""循环搭一组方块

@expect 循环搭出的一排（一列）方块，数量与循环次数一致。
@note VGroup() 无参构造 + add 累积，是很常见的搭法
"""

from manim import *


class LoopBuildScene(Scene):
    def construct(self):
        squares = VGroup()
        for i in range(4):
            sq = Square(side_length=0.8, color=BLUE)
            sq.shift(RIGHT * (i * 1.2 - 1.8))
            squares.add(sq)
        self.play(Create(squares))
        self.wait(0.3)
