"""shift / move_to / scale / rotate 链

@expect shift / move_to / scale / rotate 依次链上去，最终位置朝向与链的顺序一致。"""

from manim import *


class ProcessFamilyScene(Scene):
    def construct(self):
        square = Square(side_length=1.5, color=BLUE)
        square.shift(RIGHT * 2)
        square.move_to(UP * 1)
        square.scale(0.6)
        square.rotate(PI / 6)
        self.play(Create(square))
        self.wait(0.3)
