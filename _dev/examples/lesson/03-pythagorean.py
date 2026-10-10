"""勾股定理

@expect 直角三角形三边上贴的正方形面积关系呈现 a² + b² = c²。
@note 讲解模板：直角三角形 + 两条直角边上的正方形，公式在下方
"""

from manim import *
import numpy as np


class PythagoreanScene(Scene):
    def construct(self):
        s = 0.7
        A = np.array([0.0, 0.0, 0.0])
        B = A + RIGHT * (3 * s)
        C = A + UP * (4 * s)

        triangle = Polygon(A, B, C, color=WHITE, stroke_width=4)
        a_label = MathTex("a", font_size=40, color=BLUE).move_to((A + B) / 2 + DOWN * 0.35)
        b_label = MathTex("b", font_size=40, color=GREEN).move_to((A + C) / 2 + LEFT * 0.38)
        c_label = MathTex("c", font_size=40, color=YELLOW).move_to((B + C) / 2 + UR * 0.38)

        sq_a = Polygon(A, B, B + DOWN * (3 * s), A + DOWN * (3 * s), color=BLUE, stroke_width=3)
        sq_a.set_fill(BLUE, 0.22)
        sq_b = Polygon(A, C, C + LEFT * (4 * s), A + LEFT * (4 * s), color=GREEN, stroke_width=3)
        sq_b.set_fill(GREEN, 0.22)
        offset = np.array([4 * s, 3 * s, 0.0])
        sq_c = Polygon(B, C, C + offset, B + offset, color=YELLOW, stroke_width=3)
        sq_c.set_fill(YELLOW, 0.22)

        shapes = VGroup(triangle, sq_a, sq_b, sq_c, a_label, b_label, c_label)
        shapes.shift(-shapes.get_center())

        eq = MathTex("a^2", "+", "b^2", "=", "c^2", font_size=54)
        eq.arrange(RIGHT, buff=0.16)
        eq.to_edge(DOWN, buff=0.55)

        self.play(Create(triangle), run_time=1.0)
        self.play(Write(a_label), Write(b_label), Write(c_label), run_time=0.6)
        self.play(Create(sq_a), Create(sq_b), run_time=1.0)
        self.play(Create(sq_c), run_time=1.0)
        self.play(Write(eq), run_time=0.8)
        self.play(Indicate(eq, color=WHITE, scale_factor=1.1), run_time=0.8)
        self.wait(0.5)
