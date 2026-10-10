"""Underline 下划线

@expect 文字下方有一条下划线，长度与文字相当。"""

from manim import *


class UnderlineScene(Scene):
    def construct(self):
        txt = Text("底下的横线", font_size=40)
        line = Underline(txt, color=YELLOW)
        self.play(Write(txt), Create(line))
        self.wait(0.3)
