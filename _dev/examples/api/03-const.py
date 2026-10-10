"""API 点名：方向与轴向常量

@expect 几支箭头分别指向 RIGHT/UP/OUT 等常量对应的方向，方向与名字一致；轴向常量参与的定位不偏。
@note 方向常量在适配层就是 numpy 向量（UP * 0.2、RIGHT * 2 逐元素运算处处都是）。
      这里点 X_AXIS / Y_AXIS / Z_AXIS / IN / OUT：CE 里 X_AXIS 就是 RIGHT、Z_AXIS 就是 OUT，
      Axes / ThreeDAxes 相关代码常直接拿它当方向用——写不出这几个名字就会是 NameError。
"""

from manim import *
import numpy as np

CHECKS = [
    (X_AXIS, RIGHT),
    (Y_AXIS, UP),
    (Z_AXIS, OUT),
    (IN, -OUT),
]
print("api-const", len(CHECKS), all(np.array_equal(a, b) for a, b in CHECKS))


class ApiConstScene(Scene):
    def construct(self):
        frame = VGroup(
            Line(ORIGIN, X_AXIS * 2),
            Line(ORIGIN, Y_AXIS * 2),
            Line(ORIGIN, Z_AXIS * 0.5),
            Line(ORIGIN, IN * 0.5),
        )
        self.play(Create(frame))
        self.wait(0.2)
