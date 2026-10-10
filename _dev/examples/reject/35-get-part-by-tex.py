"""MathTex.get_part_by_tex：按 LaTeX 片段取子物体

@expect 不渲染：预检应当**当场**拒绝，报错要提到「get_part_by_tex」并给出可读的原因或替代写法。
@reject get_part_by_tex

@note manim-web 没有它——按下标取段：eq[0]（等价 eq.get_part(0)）
"""

from manim import *


class GetPartByTexScene(Scene):
    def construct(self):
        eq = MathTex("a", "+", "b")
        piece = eq.get_part_by_tex("+")
        self.add(eq)
        self.play(Indicate(piece))
