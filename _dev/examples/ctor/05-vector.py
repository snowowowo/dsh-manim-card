"""Vector 位置参数

@expect 一支箭头，方向与长度和传入的向量一致。
@note 2026-10-09 事故：Vector([...]) 当时报「位置参数暂不支持」
"""

from manim import *


class VectorScene(Scene):
    def construct(self):
        vec = Vector([2, 1, 0], color=TEAL)
        # 原点灰点 + 水平/垂直虚线勾出两个分量：方向与长度确实就是 (2, 1)
        origin = Dot(ORIGIN, color=GREY)
        along_x = DashedLine(ORIGIN, [2, 0, 0], color=GREY)
        along_y = DashedLine([2, 0, 0], [2, 1, 0], color=GREY)
        label = Text("(2, 1)", font_size=26)
        label.move_to([2.6, 1.3, 0])
        self.play(GrowArrow(vec), FadeIn(origin), Create(along_x), Create(along_y), Write(label))
        self.wait(0.3)
