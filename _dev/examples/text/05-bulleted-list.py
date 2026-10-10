"""BulletedList 项目列表

@expect 多行列表每行前有项目符号，行距整齐。
@note CE 的 BulletedList(*items) 是变长位置参数，manim-web 收 items 数组
"""

from manim import *


class BulletedListScene(Scene):
    def construct(self):
        lst = BulletedList("第一条", "第二条", "第三条", font_size=32)
        self.play(FadeIn(lst))
        self.wait(0.3)
