"""读 width 属性

@expect print 出的 width 与物体实际宽度一致（数值断言为准）。
@note 适配层的 __getattr__ 对任何名字都返回函数，读属性必须走 PROP_READS 的真取法
"""

from manim import *


class AttrReadScene(Scene):
    def construct(self):
        square = Square(side_length=2)
        w = square.width
        txt = Text("宽 " + str(round(w, 2)), font_size=32)
        txt.to_corner(DL)
        self.play(Create(square), Write(txt))
        self.wait(0.3)
