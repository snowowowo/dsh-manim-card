"""欧拉回路与哈密顿回路：一个数「边」，一个数「点」

@expect 左边是共用一个顶点的两个三角形：中心顶点度数为 4、其余都是 2，全为偶数，所以能一笔走遍每条边恰好一次（欧拉回路）；但走遍每个顶点恰好一次做不到。右边是带一条斜线的四边形：沿外圈可以走遍四个顶点（哈密顿回路），但有两个度为 3 的顶点，欧拉回路不存在。
@note 讲解要点：欧拉回路只看度数——连通且全是偶度就存在（一笔画问题）；哈密顿回路要看整体结构，至今没有简单的充要条件（属于 NP-完全）。同样是一笔画，问法差一个字，难度天差地别。
"""

from manim import *


class EulerHamiltonScene(Scene):
    def construct(self):
        # 左：蝴蝶结——有欧拉回路，无哈密顿回路
        center = [-3.7, -0.3]
        s = [center[0], center[1], 0]
        l1 = [center[0] - 1.35, center[1] + 1.0, 0]
        l2 = [center[0] - 1.35, center[1] - 1.0, 0]
        r1 = [center[0] + 1.35, center[1] + 1.0, 0]
        r2 = [center[0] + 1.35, center[1] - 1.0, 0]

        left_edges = VGroup(
            Line(s, l1, color=GRAY_B, stroke_width=3),
            Line(s, l2, color=GRAY_B, stroke_width=3),
            Line(l1, l2, color=GRAY_B, stroke_width=3),
            Line(s, r1, color=GRAY_B, stroke_width=3),
            Line(s, r2, color=GRAY_B, stroke_width=3),
            Line(r1, r2, color=GRAY_B, stroke_width=3),
        )
        left_nodes = VGroup(
            Dot(s, radius=0.16, color=YELLOW),
            Dot(l1, radius=0.14, color=WHITE),
            Dot(l2, radius=0.14, color=WHITE),
            Dot(r1, radius=0.14, color=WHITE),
            Dot(r2, radius=0.14, color=WHITE),
        )
        left_degree = Text("中心顶点度数 4，其余全为 2 —— 全偶", font_size=23, color=GREEN)
        left_degree.move_to([-3.7, -2.0, 0])
        left_yes = Text("有欧拉回路：一笔走遍每条边各一次", font_size=23, color=GREEN)
        left_yes.move_to([-3.7, -2.6, 0])
        left_no = Text("无哈密顿回路：过中心顶点只能一次，跨不过两半", font_size=23, color=RED)
        left_no.move_to([-3.7, -3.2, 0])

        # 右：四边形加斜线——有哈密顿回路，无欧拉回路
        a = [2.2, 0.9, 0]
        b = [4.6, 0.9, 0]
        c = [4.6, -1.5, 0]
        d = [2.2, -1.5, 0]

        right_edges = VGroup(
            Line(a, b, color=GRAY_B, stroke_width=3),
            Line(b, c, color=GRAY_B, stroke_width=3),
            Line(c, d, color=GRAY_B, stroke_width=3),
            Line(d, a, color=GRAY_B, stroke_width=3),
            Line(a, c, color=GRAY_B, stroke_width=3),
        )
        right_nodes = VGroup(
            Dot(a, radius=0.14, color=RED),
            Dot(b, radius=0.14, color=WHITE),
            Dot(c, radius=0.14, color=RED),
            Dot(d, radius=0.14, color=WHITE),
        )
        right_yes = Text("有哈密顿回路：沿外圈走遍四个顶点", font_size=23, color=GREEN)
        right_yes.move_to([3.4, -2.0, 0])
        right_no = Text("无欧拉回路：两个红点度数为 3（奇）", font_size=23, color=RED)
        right_no.move_to([3.4, -2.6, 0])
        right_extra = Text("欧拉看度数，哈密顿看结构", font_size=23, color=GRAY_A)
        right_extra.move_to([3.4, -3.2, 0])

        head = Text("同样是「一笔画」，问法差一个字，难度差一个量级", font_size=26, color=YELLOW)
        head.move_to([0, 3.2, 0])

        self.play(Write(head), run_time=0.7)
        self.play(Create(left_edges), FadeIn(left_nodes), run_time=1.0)
        self.play(Write(left_degree), run_time=0.6)
        self.play(Write(left_yes), Write(left_no), run_time=0.8)
        self.play(Create(right_edges), FadeIn(right_nodes), run_time=1.0)
        self.play(Write(right_yes), Write(right_no), run_time=0.8)
        self.play(Write(right_extra), run_time=0.6)
        self.wait(0.4)
