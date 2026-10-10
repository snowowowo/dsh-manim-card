"""Vector 位置参数

@expect 一支箭头，方向与长度和传入的向量一致。
@note 2026-10-09 事故：Vector([...]) 当时报「位置参数暂不支持」
"""

from manim import *


class VectorScene(Scene):
    def construct(self):
        vec = Vector([2, 1, 0], color=TEAL)
        self.play(GrowArrow(vec))
        self.wait(0.3)
