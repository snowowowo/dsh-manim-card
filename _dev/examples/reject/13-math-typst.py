"""MathTypst：数学模式 Typst

@expect 不渲染：预检应当**当场**拒绝，报错要提到「MathTypst」并给出可读的原因或替代写法。
@reject MathTypst

@note 同 Typst——manim-web 的公式一律 MathTex（KaTeX）
"""

from manim import *


class MathTypstScene(Scene):
    def construct(self):
        formula = MathTypst("integral_0^1 x^2 dif x = 1/3")
        self.add(formula)
