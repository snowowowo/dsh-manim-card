"""MarkupText 富文本

@expect 富文本的局部加粗 / 变色生效，其余部分不受影响。"""

from manim import *


class MarkupScene(Scene):
    def construct(self):
        m = MarkupText("<b>粗体</b> 与 <i>斜体</i>", font_size=44)
        self.play(FadeIn(m))
        self.wait(0.3)
