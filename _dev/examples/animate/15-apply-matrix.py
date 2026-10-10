"""ApplyMatrix 矩阵变换

@expect 物体被矩阵扭曲出斜切/旋转形变，不是平移或等比缩放。
@note CE 是 ApplyMatrix(matrix, mobject)，manim-web 的工厂反着收
"""

from manim import *


class ApplyMatrixScene(Scene):
    def construct(self):
        square = Square(side_length=2, color=BLUE)
        self.add(square)
        self.play(ApplyMatrix([[0, -1], [1, 0]], square))
        self.wait(0.3)
