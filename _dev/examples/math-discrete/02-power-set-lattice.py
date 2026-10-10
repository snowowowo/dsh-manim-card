"""幂集格：{1,2,3} 的 8 个子集按包含关系排成一个立方体

@expect 八个节点按子集大小分成四层：最上 ∅、中间两层各三个、最下 {1,2,3}；连线只在「差一个元素」的节点之间。整体形状就是一个三维立方体的平面投影。
@note 讲解要点：每往上一层就往子集里加一个元素，所以图的宽度是二项式系数 1-3-3-1；节点总数是 2³ = 8。幂集永远可以这样分层画成一格，这就是它叫布尔格的原因。
"""

from manim import *


class PowerSetLatticeScene(Scene):
    def construct(self):
        nodes = {
            "empty": [0, 2.4, "∅"],
            "a": [-3.4, 1.2, "{1}"],
            "b": [0, 1.2, "{2}"],
            "c": [3.4, 1.2, "{3}"],
            "ab": [-3.4, 0.0, "{1,2}"],
            "ac": [0, 0.0, "{1,3}"],
            "bc": [3.4, 0.0, "{2,3}"],
            "abc": [0, -1.2, "{1,2,3}"],
        }
        edges = [
            ("empty", "a"),
            ("empty", "b"),
            ("empty", "c"),
            ("a", "ab"),
            ("a", "ac"),
            ("b", "ab"),
            ("b", "bc"),
            ("c", "ac"),
            ("c", "bc"),
            ("ab", "abc"),
            ("ac", "abc"),
            ("bc", "abc"),
        ]

        circles = VGroup()
        labels = VGroup()
        for key, (x, y, name) in nodes.items():
            circle = Circle(radius=0.44, color=GRAY_B)
            circle.set_fill(GRAY_E, opacity=0.45)
            circle.move_to([x, y, 0])
            circles.add(circle)
            labels.add(Text(name, font_size=21, color=WHITE).move_to([x, y, 0]))

        links = VGroup(
            *[
                Line(nodes[a][:2] + [0], nodes[b][:2] + [0], color=GRAY_C, stroke_width=2.5)
                for a, b in edges
            ]
        )

        head = Text("幂集格：8 个子集，按包含关系分层", font_size=27, color=YELLOW).move_to([0, 3.3, 0])
        level_note = Text("层 = 子集大小：0 → 1 → 2 → 3", font_size=24, color=GREEN).move_to([0, -2.3, 0])
        count_note = MathTex(r"|P(\{1,2,3\})| = 2^3 = 8", font_size=40).move_to([0, -3.1, 0])

        self.play(Write(head), run_time=0.6)
        self.play(Create(links), run_time=0.9)
        self.play(LaggedStart(*[FadeIn(c) for c in circles], lag_ratio=0.1), run_time=1.2)
        self.play(Write(labels), run_time=0.8)
        self.play(Write(level_note), run_time=0.7)
        self.play(Write(count_note), run_time=0.8)
        self.wait(0.4)
