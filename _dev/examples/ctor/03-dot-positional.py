"""Dot 位置参数（坐标）

@expect 点落在传入的坐标处，不在默认原点。"""

from manim import *


class DotPositionalScene(Scene):
    def construct(self):
        dot = Dot([1.5, 1, 0], color=RED)
        # 原点灰点 + 从原点连到红点的虚线 + 坐标标注：红点确实落在 (1.5, 1) 而非原点
        origin = Dot(ORIGIN, color=GREY)
        guide = DashedLine(ORIGIN, [1.5, 1, 0], color=GREY)
        label = Text("(1.5, 1)", font_size=26)
        label.move_to([2.45, 1.0, 0])
        self.play(GrowFromCenter(dot), FadeIn(origin), Create(guide), Write(label))
        self.wait(0.3)
