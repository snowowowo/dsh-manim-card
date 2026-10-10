"""Text 字重、字形与字号

@expect 几段 Text 的字重 / 斜体 / 字号差异肉眼可见。
@note CE 的 weight / slant 在 manim-web 里叫 fontWeight / fontStyle（camel 推不出来）
"""

from manim import *


class TextKwargsScene(Scene):
    def construct(self):
        title = Text("粗体标题", font_size=56, weight=BOLD, color=YELLOW)
        note = Text("斜体说明", font_size=32, slant=ITALIC)
        note.shift(DOWN * 1.5)
        self.play(Write(title), FadeIn(note))
        self.wait(0.3)
