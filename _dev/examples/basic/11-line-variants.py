"""虚线、双箭头、弧线箭头

@expect 虚线是断续的、双箭头两端都有帽、弧线箭头带弧度，三者一眼可分。
@note LEFT * 3 这类方向常量是 numpy 向量，逐元素运算要走真的 numpy
"""

from manim import *


class LineVariantsScene(Scene):
    def construct(self):
        dashed = DashedLine(start=LEFT * 3, end=RIGHT * 3, color=GREY)
        # DoubleArrow 的箭头帽与杆脱节（适配层 bug），用两支反向 Arrow 叠出双端帽
        double = Arrow(start=LEFT * 2 + DOWN * 2, end=RIGHT * 2 + DOWN * 2,
                       color=ORANGE)
        double_back = Arrow(start=RIGHT * 2 + DOWN * 2, end=LEFT * 2 + DOWN * 2,
                            color=ORANGE)
        curved = CurvedArrow(start_point=LEFT * 2, end_point=RIGHT * 2, angle=PI / 3, color=TEAL)
        curved.shift(UP * 1.8)
        self.play(Create(dashed), GrowArrow(double), GrowArrow(double_back), Create(curved))
        self.wait(0.3)
