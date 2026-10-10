"""c2p 把坐标换算成画布位置

@expect 标记点精确落在 c2p 换算出的坐标位置上（print 的数值与画面一致）。
@note c2p / get_center 返回的是数值数组，适配层必须换成向量，否则 + 会变成列表拼接
"""

from manim import *


class C2pScene(Scene):
    def construct(self):
        ax = Axes(x_range=[-2, 2, 1], y_range=[-2, 2, 1], include_numbers=True)
        line = Line(start=ax.c2p(-2, -2), end=ax.c2p(2, 2), color=YELLOW)
        dot = Dot(point=ax.c2p(1, 1), color=RED)
        # 自证落点：从点向两轴引虚线，MathTex("1") 标出 x=1 / y=1 的位置
        vx = DashedLine(start=ax.c2p(1, 1), end=ax.c2p(1, -2), color=GREY)
        hy = DashedLine(start=ax.c2p(1, 1), end=ax.c2p(-2, 1), color=GREY)
        lx = MathTex("1", font_size=30).move_to([ax.c2p(1, 0)[0], ax.c2p(1, 0)[1] - 0.3, 0])
        ly = MathTex("1", font_size=30).move_to([ax.c2p(0, 1)[0] - 0.3, ax.c2p(0, 1)[1], 0])
        self.play(Create(ax), Create(line), FadeIn(dot), Create(vx), Create(hy), FadeIn(lx), FadeIn(ly))
        self.wait(0.3)
