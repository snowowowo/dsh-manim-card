"""DrawBorderThenFill 描边后填充

@expect 先只描出轮廓线，随后填充色才填进来——两个阶段看得出来。
        「轮廓先行、填充后到」是过程性的——真时序观察；适配层在动画终态
        不落填充，故动画后再补一条 set_fill 动画，终帧为填满黄色的方块。
"""

from manim import *


class DrawBorderScene(Scene):
    def construct(self):
        square = Square(side_length=2, color=YELLOW)
        self.play(DrawBorderThenFill(square))
        # 终态填充适配层不落、play 外改属性不重绘，用 .animate 补一次填充
        self.play(square.animate.set_fill(YELLOW, 1.0), run_time=0.6)
        self.wait(0.3)
