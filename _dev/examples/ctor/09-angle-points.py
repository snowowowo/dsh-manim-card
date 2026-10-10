"""Angle 收三个点

@expect 圆弧贴着三个点确定的角张開，弧的开口与角一致。"""

from manim import *


class AnglePointsScene(Scene):
    def construct(self):
        # 三个点：A 是顶点，B、C 张开角的两条边；把点画出来才能核对「弧贴着角」
        a = [-2.5, -1.5, 0]
        b = [1.5, -1.5, 0]
        c = [0.0, 1.4, 0]
        line_ab = Line(a, b, color=GREY)
        line_ac = Line(a, c, color=GREY)
        # 三点定角：中间那个点是顶点（与 CE from_three_points 一致），故把 A 放中间
        angle = Angle([b, a, c], radius=0.7, color=YELLOW)
        dot_a = Dot(a, color=RED)
        dot_b = Dot(b, color=RED)
        dot_c = Dot(c, color=RED)
        label_a = Text("A", font_size=28, color=RED).next_to(dot_a, DL, buff=0.15)
        label_b = Text("B", font_size=28, color=RED).next_to(dot_b, DOWN, buff=0.15)
        label_c = Text("C", font_size=28, color=RED).next_to(dot_c, UP, buff=0.15)
        self.play(Create(line_ab), Create(line_ac), Create(angle),
                  FadeIn(dot_a), FadeIn(dot_b), FadeIn(dot_c),
                  Write(label_a), Write(label_b), Write(label_c))
        self.wait(0.3)
