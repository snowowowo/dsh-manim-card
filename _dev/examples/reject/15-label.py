"""Label：带背景框的标签

@expect 不渲染：预检应当**当场**拒绝，报错要提到「Label」并给出可读的原因或替代写法。
@reject Label

@note manim-web 没有 Label——用 Text + BackgroundRectangle 组装
"""

from manim import *


class LabelScene(Scene):
    def construct(self):
        label = Label("重要", color=YELLOW)
        label.next_to(Dot(), UP)
        self.add(label)
