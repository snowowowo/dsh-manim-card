"""哈斯图：只画「覆盖关系」，不可比的两个元素一眼看出

@expect {1,2,3,6} 按整除关系排成菱形——1 在最下、6 在最上，而 2 和 3 并排站在中间；2 与 3 之间没有连线，被标上「不可比」。从 1 到 6 的传递关系也没有画线。
@note 讲解要点：哈斯图省掉两类边：传递得到的不画（1|6 就不画），自反的环也不画。所以图中「没有边」只说明两者不可比或能被传递推出，不能读成「没关系」。菱形里 2∥3 这种「既不左也不右」的元素，偏序才会有、全序不会有。
"""

from manim import *


class HasseDiagramScene(Scene):
    def construct(self):
        nodes = {
            "one": [0, -1.9, "1"],
            "two": [-2.3, -0.1, "2"],
            "three": [2.3, -0.1, "3"],
            "six": [0, 1.5, "6"],
        }
        edges = [("one", "two"), ("one", "three"), ("two", "six"), ("three", "six")]

        circles = VGroup()
        labels = VGroup()
        for key, (x, y, name) in nodes.items():
            circle = Circle(radius=0.45, color=GRAY_B)
            circle.set_fill(GRAY_E, opacity=0.5)
            circle.move_to([x, y, 0])
            circles.add(circle)
            labels.add(Text(name, font_size=30, color=YELLOW).move_to([x, y, 0]))

        links = VGroup(
            *[
                Line(nodes[a][:2] + [0], nodes[b][:2] + [0], color=GRAY_C, stroke_width=3)
                for a, b in edges
            ]
        )

        incomparable = DashedLine([-2.3, -0.1, 0], [2.3, -0.1, 0], color=RED)
        incomparable_label = Text("2 与 3 不可比（互不整除）", font_size=24, color=RED)
        incomparable_label.move_to([0, -0.62, 0])

        # 被省略的传递边 1→6：沿真实方向画虚线示意，两端各离开圆边 0.15，不穿过任何节点
        skipped = DashedLine([0, -1.3, 0], [0, 0.9, 0], color=GRAY_D)
        skipped_label = Text("1 整除 6 由传递得到，不画", font_size=23, color=GRAY_A)
        skipped_label.move_to([4.4, 1.0, 0])

        caption = Text("哈斯图 = 去掉传递边、去掉自反环之后的整除关系", font_size=25, color=GREEN)
        caption.move_to([0, -3.2, 0])
        head = Text("整除偏序 ({1,2,3,6}, |) 的哈斯图", font_size=27, color=YELLOW).move_to([0, 3.0, 0])

        self.play(Write(head), run_time=0.6)
        self.play(Create(links), run_time=0.8)
        self.play(LaggedStart(*[FadeIn(c) for c in circles], lag_ratio=0.15), run_time=1.0)
        self.play(Write(labels), run_time=0.7)
        self.play(Create(incomparable), Write(incomparable_label), run_time=0.8)
        self.play(Create(skipped), Write(skipped_label), run_time=0.8)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
