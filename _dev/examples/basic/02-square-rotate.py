"""方块旋转 45°

@expect 方块绕自身中心旋转 45°，位置与大小不变。"""

from manim import *


class SquareRotateScene(Scene):
    def construct(self):
        square = Square(side_length=2, color=YELLOW)
        self.play(Create(square))
        self.play(square.animate.rotate(PI / 4))
        self.wait(0.3)
