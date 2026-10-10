"""to_edge / to_corner

@expect 物体贴到指定边 / 角，并与边界留出 buff。"""

from manim import *


class EdgeCornerScene(Scene):
    def construct(self):
        txt = Text("左上角", font_size=36)
        txt.to_corner(UL)
        dot = Dot(color=RED)
        dot.to_edge(DR)
        self.play(Write(txt), FadeIn(dot))
        self.wait(0.3)
