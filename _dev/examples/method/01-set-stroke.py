"""set_stroke（改写为 setStyle）

@expect 只有描边变了（粗细 / 颜色），填充保持原样——set_stroke 冲掉填充是修过的事故，这条钉它。
@note 2026-10-09 事故：manim-web 的 Mobject 没有 setStroke，当时直接报「无对应方法」
"""

from manim import *


class SetStrokeScene(Scene):
    def construct(self):
        circle = Circle(radius=1.4)
        circle.set_stroke(color=RED, width=6)
        self.play(Create(circle))
        self.wait(0.3)
