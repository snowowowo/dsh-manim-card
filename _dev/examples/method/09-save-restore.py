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
        # 改动后的红色偏移副本留作影子：restore 后与居中蓝方块同框对照
        ghost = square.copy()
        square.restore()
        self.add(ghost)
        self.wait(0.3)
