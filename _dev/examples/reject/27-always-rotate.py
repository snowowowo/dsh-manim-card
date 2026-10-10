"""always_rotate：让物体一直转

@expect 不渲染：预检应当**当场**拒绝，报错要提到「always_rotate」并给出可读的原因或替代写法。
@reject always_rotate

@note manim-web 没有 always_rotate——用 add_updater(lambda m, dt: m.rotate(rate * dt))
"""

from manim import *


class AlwaysRotateScene(Scene):
    def construct(self):
        square = Square(side_length=1.5)
        self.add(always_rotate(square, rate=PI / 4))
        self.wait(0.5)
