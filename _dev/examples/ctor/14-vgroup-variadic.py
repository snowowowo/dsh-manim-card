"""VGroup 变长位置参数

@expect 若干物体收进一个 VGroup 后整体定位：一起移动、相对位置不变。"""

from manim import *


class VgroupVariadicScene(Scene):
    def construct(self):
        group = VGroup(Circle(radius=0.6), Square(side_length=1), Triangle())
        group.arrange(RIGHT, buff=0.6)
        self.play(Create(group))
        self.wait(0.3)
