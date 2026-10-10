"""cycle_animation：把动画循环着播

@expect 不渲染：预检应当**当场**拒绝，报错要提到「cycle_animation」并给出可读的原因或替代写法。
@reject cycle_animation

@note manim-web 没有 cycle_animation——用 add_updater 反复起动画，或直接 loop 多段 play
"""

from manim import *


class CycleAnimationScene(Scene):
    def construct(self):
        dot = Dot()
        self.add(dot, cycle_animation(Flash(dot)))
        self.wait(0.5)
