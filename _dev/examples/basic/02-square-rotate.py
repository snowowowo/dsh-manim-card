"""方块旋转 45°

@expect 方块绕自身中心旋转 45°，位置与大小不变。"""

from manim import *


class SquareRotateScene(Scene):
    def construct(self):
        square = Square(side_length=2, color=YELLOW)
        self.play(Create(square))
        # 旋转前存一份灰色 ghost：转完后它在原位，衬出「转了 45° 但中心与大小没变」
        ghost = square.copy().set_stroke(GREY, opacity=0.35)
        self.play(square.animate.rotate(PI / 4))
        label = Text("旋转 45°", font_size=26)
        label.move_to([0, -2.2, 0])
        self.add(ghost, label)
        self.wait(0.3)
