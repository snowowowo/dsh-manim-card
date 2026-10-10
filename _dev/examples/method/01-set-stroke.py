"""set_stroke（改写为 setStyle）

@expect 只有描边变了（粗细 / 颜色），填充保持原样——set_stroke 冲掉填充是修过的事故，这条钉它。
@note 2026-10-09 事故：manim-web 的 Mobject 没有 setStroke，当时直接报「无对应方法」
"""

from manim import *


class SetStrokeScene(Scene):
    def construct(self):
        circle = Circle(radius=1.4, fill_opacity=0.5)
        # 并排一颗未改动的对照圆（灰描边）：两颗填充一致，证明 set_stroke 只动了描边
        control = circle.copy()
        circle.set_stroke(color=RED, width=6)
        control.set_stroke(color=GREY)
        circle.shift(LEFT * 2.6)
        control.shift(RIGHT * 2.6)
        self.play(Create(circle), Create(control))
        self.wait(0.3)
