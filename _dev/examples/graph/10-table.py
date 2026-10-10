"""表格 + 表头

@expect 表格带表头行，行列对齐、格线齐全。
@note CE 的表首参叫 table，manim-web 的键叫 data；单元格要物体（manim-web 不换算数字）
"""

from manim import *


class TableScene(Scene):
    def construct(self):
        grid = Table([[Text("1"), Text("2")], [Text("3"), Text("4")]], col_labels=[Text("甲"), Text("乙")])
        self.play(FadeIn(grid))
        self.wait(0.3)
