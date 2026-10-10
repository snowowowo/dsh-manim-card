"""RightAngle 收两条线

@expect 直角记号（小折角）立在两条线相交的角上。
@note 2026-10-09 事故：两个错叠在一起——位置参数未登记 + line1 句柄没解析（getStart is not a function）
"""

from manim import *


class RightAngleScene(Scene):
    def construct(self):
        line1 = Line(start=[-2, -1, 0], end=[0, -1, 0])
        line2 = Line(start=[0, -1, 0], end=[0, 1, 0])
        right = RightAngle(line1, line2, length=0.4)
        self.add(line1, line2)
        self.play(Create(right))
        self.wait(0.3)
