"""更新器收 (m, dt) 两个参数

@expect (m, dt) 更新器在 wait 期间按真实时间推进，不是只在动画里动。
@note manim-web 的 updater 签名是 (mobject, dt)
"""

from manim import *


class WithDtScene(Scene):
    def construct(self):
        dot = Dot(point=LEFT * 3, color=RED)
        def step(m, dt):
            m.shift(RIGHT * dt * 2)
        dot.add_updater(step)
        self.add(dot)
        self.play(dot.animate.shift(RIGHT * 0.01), run_time=1)
        self.wait(0.3)
