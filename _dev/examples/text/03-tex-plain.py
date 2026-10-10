"""Tex 收一段 LaTeX

@expect 一整段 LaTeX 排成公式，字体与间距正常。"""

from manim import *


class TexPlainScene(Scene):
    def construct(self):
        t = Tex("E = mc^2", font_size=48)
        self.play(Write(t))
        self.wait(0.3)
