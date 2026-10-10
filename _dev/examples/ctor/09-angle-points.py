"""Angle 收三个点

@expect 圆弧贴着三个点确定的角张開，弧的开口与角一致。"""

from manim import *


class AnglePointsScene(Scene):
    def construct(self):
        angle = Angle([[0, 0, 0], [1.5, 0, 0], [1, 1, 0]], radius=0.5)
        self.play(Create(angle))
        self.wait(0.3)
