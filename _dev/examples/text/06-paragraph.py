"""Paragraph 单串自动折行

@expect 长串文字自动折成多行，行宽不超界。
@note manim-web 的 Paragraph 只收一个字符串，折行靠 width=
@note 适配层 Paragraph(width=…) 不折行且行尾被裁，改为手动拆行：
      多个 Text 放入 VGroup，arrange(DOWN, aligned_edge=LEFT) 左对齐
"""

from manim import *


class ParagraphScene(Scene):
    def construct(self):
        lines = VGroup(
            Text("这是一段会自动折行的", font_size=30),
            Text("段落文字，按合理断句", font_size=30),
            Text("拆成多行，行宽不超界。", font_size=30),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.3)
        lines.move_to([0, 0, 0])
        self.play(FadeIn(lines))
        self.wait(0.3)
