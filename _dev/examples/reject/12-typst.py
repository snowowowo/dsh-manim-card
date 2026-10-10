"""Typst：Typst 排版

@expect 不渲染：预检应当**当场**拒绝，报错要提到「Typst」并给出可读的原因或替代写法。
@reject Typst

@note manim-web 只走 KaTeX——公式用 MathTex（LaTeX 语法），Typst 语法不认
"""

from manim import *


class TypstScene(Scene):
    def construct(self):
        formula = Typst("sum_(i=1)^n i = (n (n+1)) / 2")
        self.play(Write(formula))
