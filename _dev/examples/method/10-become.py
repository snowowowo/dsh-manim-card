"""become 换形

@expect 播完后物体变成了目标形状（become 是直接换形，不是复制一份）。"""

from manim import *


class BecomeScene(Scene):
    def construct(self):
        circle = Circle(radius=1, color=BLUE)
        square = Square(side_length=2, color=YELLOW)
        self.add(square)
        # become 前存方块 ghost：become 后灰方块轮廓与蓝圆并存，直接看出「换形」
        ghost = square.copy().set_stroke(GREY, opacity=0.35)
        square.become(circle)
        label = Text("become 换形", font_size=26)
        label.move_to([0, -2.2, 0])
        self.add(ghost, label)
        self.wait(0.3)
