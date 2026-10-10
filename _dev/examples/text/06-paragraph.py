"""Paragraph 单串自动折行

@expect 长串文字自动折成多行，行宽不超界。
@note manim-web 的 Paragraph 只收一个字符串，折行靠 width=
"""

from manim import *


class ParagraphScene(Scene):
    def construct(self):
        p = Paragraph("这是一段会自动折行的段落文字", width=4, font_size=30)
        self.play(FadeIn(p))
        self.wait(0.3)
