"""整数表（直接写数字）

@expect 整数直接填进格子（不经过 LaTeX 数字格式化），内容一致。
@note 纯数字的表走 IntegerTable / DecimalTable——它们才收原始数字
"""

from manim import *


class IntegerTableScene(Scene):
    def construct(self):
        grid = IntegerTable([[1, 2], [3, 4]])
        self.play(FadeIn(grid))
        self.wait(0.3)
