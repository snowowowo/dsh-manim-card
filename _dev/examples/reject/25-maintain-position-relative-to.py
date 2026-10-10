"""MaintainPositionRelativeTo：跟随另一个物体保持相对位置

@expect 不渲染：预检应当**当场**拒绝，报错要提到「MaintainPositionRelativeTo」并给出可读的原因或替代写法。
@reject MaintainPositionRelativeTo

@note manim-web 没有这个动画——用 add_updater 手动跟
"""

from manim import *


class MaintainPositionScene(Scene):
    def construct(self):
        line = Line(LEFT * 2, RIGHT * 2)
        dot = Dot(line.get_center())
        self.add(line, dot)
        self.play(MaintainPositionRelativeTo(dot, line), line.animate.shift(UP))
