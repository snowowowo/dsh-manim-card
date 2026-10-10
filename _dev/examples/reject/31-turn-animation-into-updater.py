"""turn_animation_into_updater：把动画变成持续运行的 updater

@expect 不渲染：预检应当**当场**拒绝，报错要提到「turn_animation_into_updater」并给出可读的原因或替代写法。
@reject turn_animation_into_updater

@note manim-web 没有它——持续效果用 add_updater 自己写
"""

from manim import *


class TurnAnimationIntoUpdaterScene(Scene):
    def construct(self):
        dot = Dot()
        dot.add_updater(turn_animation_into_updater(Flash(dot)))
        self.add(dot)
        self.wait(0.5)
