"""矩阵

@expect 矩阵按行列排布，元素与传入内容一致。
@note CE 的 Matrix(*rows) 是位置参数；manim-web 的构造器首参也是数据
"""

from manim import *


class MatrixScene(Scene):
    def construct(self):
        m = Matrix([[1, 2], [3, 4]])
        self.play(Write(m))
        self.wait(0.3)
