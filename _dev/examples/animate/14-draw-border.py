"""DrawBorderThenFill 描边后填充

@expect 先只描出轮廓线，随后填充色才填进来——两个阶段看得出来。"""

from manim import *


class DrawBorderScene(Scene):
    def construct(self):
        self.play(DrawBorderThenFill(Square(side_length=2, color=YELLOW)))
        self.wait(0.3)
