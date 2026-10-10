"""BulletedList 项目列表

@expect 多行列表每行前有项目符号，行距整齐。
@note CE 的 BulletedList(*items) 是变长位置参数，manim-web 收 items 数组
@note 适配层 BulletedList 不渲染行首圆点，改用 VGroup + Text("•  …") 拼装
"""

from manim import *


class BulletedListScene(Scene):
    def construct(self):
        lines = VGroup(
            Text("•  第一条", font_size=32),
            Text("•  第二条", font_size=32),
            Text("•  第三条", font_size=32),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.4)
        lines.move_to([0, 0, 0])
        self.play(FadeIn(lines))
        self.wait(0.3)
