"""圆弧与扇形

@expect 一段圆弧（只描边）与一个扇形（弧 + 两条半径 + 填充）。"""

from manim import *


class ArcSectorScene(Scene):
    def construct(self):
        arc = Arc(radius=1.5, start_angle=0, angle=PI / 2, color=YELLOW)
        sector = Sector(radius=1.5, angle=PI / 3, color=ORANGE, fill_opacity=0.5)
        sector.shift(RIGHT * 3)
        self.play(Create(arc), Create(sector))
        self.wait(0.3)
