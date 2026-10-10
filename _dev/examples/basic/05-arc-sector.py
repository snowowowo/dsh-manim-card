"""圆弧与扇形

@expect 一段圆弧（只描边）与一个扇形（弧 + 两条半径 + 填充）。"""

from manim import *


class ArcSectorScene(Scene):
    def construct(self):
        # 弧与扇形都用 -45°~+45° 的对称角度范围，左右对称构图
        arc = Arc(radius=1.5, start_angle=-PI / 4, angle=PI / 2, color=YELLOW)
        arc.shift(LEFT * 3.2)
        arc_label = Text("圆弧（只描边）", font_size=26, color=YELLOW)
        arc_label.move_to([-3.2, -2.2, 0])

        sector = Sector(radius=1.5, start_angle=-PI / 4, angle=PI / 2,
                        color=ORANGE, fill_opacity=0.5)
        sector.shift(RIGHT * 3.2)
        sector_label = Text("扇形（弧 + 半径 + 填充）", font_size=26, color=ORANGE)
        sector_label.move_to([3.2, -2.2, 0])

        self.play(Create(arc), Write(arc_label), Create(sector), Write(sector_label))
        self.wait(0.3)
