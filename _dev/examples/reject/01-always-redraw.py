"""always_redraw：表里实测缺失

@expect 不渲染：预检应当**当场**拒绝，报错要提到「always_redraw」并给出可读的原因或替代写法。
@reject always_redraw

@note 预检当场拒并给替代写法（用 add_updater 组合）
"""

from manim import *


class AlwaysRedrawScene(Scene):
    def construct(self):
        dot = Dot()
        line = always_redraw(lambda: Line([0, 0, 0], dot.get_center()))
        self.add(line)
