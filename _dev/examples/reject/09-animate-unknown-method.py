"""animate 链里没有的方法

@expect 不渲染：预检应当**当场**拒绝，报错要提到「animate」并给出可读的原因或替代写法。
@reject animate

@note animate 白名单是探针实测的写死一批；不在表里当场报错并列出可用方法
"""

from manim import *


class AnimateUnknownMethodScene(Scene):
    def construct(self):
        circle = Circle(radius=1.2)
        self.add(circle)
        self.play(circle.animate.set_z_index(2))
