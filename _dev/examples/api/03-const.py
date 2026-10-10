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
        # X/Y 轴方向：两支有头箭头，方向可读
        arrow_x = Arrow(ORIGIN, RIGHT * 2.2, buff=0, color=YELLOW)
        arrow_y = Arrow(ORIGIN, UP * 2.2, buff=0, color=YELLOW)
        arrow_x.move_to([-4, -1.2, 0])
        arrow_y.move_to([-0.8, -1.2, 0])
        label_x = Text("X_AXIS = RIGHT", font_size=24).next_to(arrow_x, DOWN, buff=0.3)
        label_y = Text("Y_AXIS = UP", font_size=24).next_to(arrow_y, DOWN, buff=0.3)
        self.add(arrow_x, arrow_y, label_x, label_y)
        # Z_AXIS/OUT 与 IN 在 2D 投影为零——用说明卡 + 同心圆示意进屏/出屏
        card = Text("OUT = 垂直屏幕（出屏）\nIN = 进屏", font_size=24, line_spacing=0.6)
        card.move_to([2.5, 1.2, 0])
        rings = VGroup(*[Circle(radius=0.3 + 0.35 * i, color=BLUE) for i in range(3)])
        rings.move_to([2.5, -1.8, 0])
        rings_label = Text("进屏 / 出屏 ⊙", font_size=24).next_to(rings, DOWN)
        self.add(card, rings, rings_label)
        self.wait(0.3)
