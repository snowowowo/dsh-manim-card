"""LaTeX 表

@expect 表格内容按 LaTeX 排版（公式字体），不是普通文本字体。
@note MathTable 收 LaTeX 字符串，manim-web 自己排成公式
"""

from manim import *


class MathTableScene(Scene):
    def construct(self):
        grid = MathTable([[r"\frac{1}{2}", r"\sqrt{3}"], [r"a^2", r"b^2"]])
        self.play(FadeIn(grid))
        self.wait(0.3)
