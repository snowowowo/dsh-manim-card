"""always_shift：让物体一直平移

@expect 不渲染：预检应当**当场**拒绝，报错要提到「always_shift」并给出可读的原因或替代写法。
@reject always_shift

@note manim-web 没有 always_shift——用 add_updater(lambda m, dt: m.shift(direction * rate * dt))
"""

from manim import *


class AlwaysShiftScene(Scene):
    def construct(self):
        dot = Dot()
        self.add(always_shift(dot, direction=RIGHT, rate=0.5))
        self.wait(0.5)
