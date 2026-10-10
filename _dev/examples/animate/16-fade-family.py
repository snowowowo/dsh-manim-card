"""FadeIn / FadeOut

@expect FadeIn 是从透明渐显、FadeOut 是渐隐到消失，其余状态不变。"""

from manim import *


class FadeFamilyScene(Scene):
    def construct(self):
        circle = Circle(radius=1.5, color=BLUE)
        self.play(FadeIn(circle, shift=UP * 0.5))
        self.play(FadeOut(circle))
        self.wait(0.3)
