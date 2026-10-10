"""单位圆与三角函数线

@expect 单位圆上一点转动，正弦 / 余弦线随角度伸缩，长度与角度对得上。
@note 讲解模板：角度 → 圆上一点 → sin / cos 两条投影线。讲定义的静态图
"""

from manim import *
import numpy as np


class UnitCircleScene(Scene):
    def construct(self):
        radius = 1.6
        angle = 55 * DEGREES
        point = np.array([radius * np.cos(angle), radius * np.sin(angle), 0])

        circle = Circle(radius=radius, color=BLUE)
        radius_line = Line(start=ORIGIN, end=point, color=YELLOW)
        cos_leg = Line(start=ORIGIN, end=[point[0], 0, 0], color=GREEN)
        sin_leg = Line(start=[point[0], 0, 0], end=point, color=RED)
        dot = Dot(point=point, radius=0.08, color=YELLOW)
        arc = Angle([[0, 0, 0], [radius, 0, 0], point], radius=0.4)
        label_cos = MathTex(r"\cos\theta", color=GREEN).next_to(cos_leg, DOWN)
        label_sin = MathTex(r"\sin\theta", color=RED).next_to(sin_leg, RIGHT)

        self.play(Create(circle))
        self.play(Create(radius_line), FadeIn(dot), Create(arc))
        self.play(Create(cos_leg), Write(label_cos))
        self.play(Create(sin_leg), Write(label_sin))
        self.wait(0.3)
