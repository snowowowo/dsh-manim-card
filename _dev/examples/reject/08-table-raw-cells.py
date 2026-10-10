"""Table 直接写数字

@expect 不渲染：预检应当**当场**拒绝，报错要提到「Table」并给出可读的原因或替代写法。
@reject Table

@note CE 会把数字换算成文字，manim-web 只收物体——当场拒并指出改用 IntegerTable
"""

from manim import *


class TableRawCellsScene(Scene):
    def construct(self):
        grid = Table([[1, 2], [3, 4]])
        self.add(grid)
