"""Brace 收一个物体

@expect 花括号贴在物体一侧，长短与物体相当。
@note 2026-10-09 事故：报错文案把 AI 推去写 Brace(mobject=...)，结果整个 kwargs 被当成首个位置参数
"""

from manim import *


class BraceScene(Scene):
    def construct(self):
        square = Square(side_length=1.6)
        brace = Brace(square, buff=0.2)
        label = brace.get_text("1.6")
        self.play(Create(square), GrowFromCenter(brace))
        self.play(Write(label))
        self.wait(0.3)
