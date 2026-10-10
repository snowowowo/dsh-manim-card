"""m.animate 链式

@expect 方块先挪到右侧、再变色再放大（链上多个变更一起落到终态），过程平滑。"""

from manim import *


class ChainScene(Scene):
    def construct(self):
        square = Square(side_length=1.5)
        self.add(square)
        self.play(square.animate.shift(RIGHT * 2).set_color(RED).scale(1.3))
        self.wait(0.3)
