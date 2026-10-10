"""VGroup 变长位置参数

@expect 若干物体收进一个 VGroup 后整体定位：一起移动、相对位置不变。"""

from manim import *


class VgroupVariadicScene(Scene):
    def construct(self):
        group = VGroup(Circle(radius=0.6), Square(side_length=1), Triangle())
        group.arrange(RIGHT, buff=0.6)
        # ghost 用同字面量重建、同样 arrange（整组 copy / 非字面量 VGroup 都会丢位置）：
        # 移位后 ghost 留在原位，衬出「整组一起动、相对位置不变」
        ghost = VGroup(Circle(radius=0.6), Square(side_length=1), Triangle())
        ghost.arrange(RIGHT, buff=0.6)
        ghost.set_opacity(0.3)
        self.play(Create(group))
        group.shift(UP * 1.2)
        self.add(ghost)
        self.wait(0.3)
