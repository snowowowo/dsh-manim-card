"""平面网格

@expect 平面网格两个方向的线都齐整，间距一致。"""

from manim import *


class NumberPlaneScene(Scene):
    def construct(self):
        plane = NumberPlane(x_range=[-4, 4, 1], y_range=[-3, 3, 1])
        self.play(Create(plane))
        # 自证等比：对角线若穿过每个网格交点，则横向/纵向格距相等
        diagonal = DashedLine(start=plane.c2p(-4, -3), end=plane.c2p(4, 3), color=YELLOW)
        unit_dot = Dot(point=plane.c2p(1, 1), color=RED)
        label = Text("1×1 单位格", font_size=24).move_to(plane.c2p(2.2, 1.4))
        self.play(Create(diagonal), FadeIn(unit_dot), FadeIn(label))
        self.wait(0.3)
