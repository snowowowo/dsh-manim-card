"""Paragraph 多行写法

@expect 不渲染：预检应当**当场**拒绝，报错要提到「Paragraph」并给出可读的原因或替代写法。
@reject Paragraph

@note CE 的 Paragraph(*lines) 是多行；manim-web 只收一个字符串——拒的时候要说清怎么改
"""

from manim import *


class ParagraphMultilineScene(Scene):
    def construct(self):
        p = Paragraph("第一行", "第二行")
        self.add(p)
