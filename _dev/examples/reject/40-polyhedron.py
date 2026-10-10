"""Polyhedron：多面体的抽象基类

@expect 不渲染：预检应当**当场**拒绝，报错要提到「Polyhedron」并列出该换的具体类。
@reject Polyhedron

@note manim-web 里有 Polyhedron 这个名字，但它是抽象基类——构造即
      this._createGeometry is not a function，用户完全看不出该怎么办。
      所以按抽象基类处理，给出可读说法与替代（Cube / Sphere / Tetrahedron …）。
"""

from manim import *


class PolyhedronScene(Scene):
    def construct(self):
        shape = Polyhedron()
        self.add(shape)
