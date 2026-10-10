"""save_state / restore

@expect 改动后 restore 回到 save_state 时的样子（位置 / 大小 / 样式都回去）。
@note CE 的 restore() 在 manim-web 叫 restoreState()
"""

from manim import *


class SaveRestoreScene(Scene):
    def construct(self):
        square = Square(side_length=2, color=BLUE)
        square.save_state()
        self.add(square)
        self.play(square.animate.shift(RIGHT * 2).set_color(RED))
        square.restore()
        self.wait(0.3)
