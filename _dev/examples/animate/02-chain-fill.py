"""animate 链里改填充

@expect 动画结束物体的填充色变成目标色，且是「渐变过去」不是瞬间跳变。"""

from manim import *


class ChainFillScene(Scene):
    def construct(self):
        square = Square(side_length=2)
        self.add(square)
        self.play(square.animate.set_fill(BLUE, opacity=0.6).rotate(PI / 4))
        self.wait(0.3)
