"""子群格：Z/12 的全部子群连成一张偏序图

@expect 六个节点按「包含关系」上下排列——最上是整个 Z/12，最下是 {0}，中间按阶数 6、4、3、2 依次铺开；连线只在「直接包含」的节点之间出现，构成一张格图。
@note 讲解要点：Z/n 的子群与 n 的正因子一一对应，d 对应唯一的 d 阶子群 ⟨n/d⟩。所以 12 有 6 个正因子，就恰好有 6 个子群——整数分解的算术，完全决定了这张图的形状。
"""

from manim import *


class SubgroupLatticeScene(Scene):
    def construct(self):
        nodes = {
            "top": [-2.3, 2.5, "Z/12", 12],
            "h6": [-4.1, 1.0, "⟨2⟩", 6],
            "h4": [-0.5, 1.0, "⟨3⟩", 4],
            "h3": [-4.9, -0.5, "⟨4⟩", 3],
            "h2": [-1.4, -0.5, "⟨6⟩", 2],
            "h1": [-2.9, -2.0, "⟨0⟩", 1],
        }
        edges = [
            ("top", "h6"),
            ("top", "h4"),
            ("h6", "h3"),
            ("h6", "h2"),
            ("h4", "h2"),
            ("h3", "h1"),
            ("h2", "h1"),
        ]

        circles = VGroup()
        labels = VGroup()
        for key, (x, y, symbol, order) in nodes.items():
            style = Circle(radius=0.54, color=GRAY_B)
            style.set_fill(GRAY_E, opacity=0.5)
            style.move_to([x, y, 0])
            circles.add(style)
            pair = VGroup(
                Text(symbol, font_size=21, color=WHITE),
                Text(f"阶 {order}", font_size=15, color=GREEN),
            )
            pair.arrange(DOWN, buff=0.06).move_to([x, y, 0])
            labels.add(pair)

        links = VGroup(
            *[
                Line(nodes[a][:2] + [0], nodes[b][:2] + [0], color=GRAY_C, stroke_width=2.5)
                for a, b in edges
            ]
        )

        head = Text("Z/12 的全部子群只有这 6 个", font_size=27, color=YELLOW).move_to([-2.5, 3.35, 0])
        right_notes = VGroup(
            Text("阶 12 → 6 / 4 → 3 / 2 → 1", font_size=24, color=GREEN).move_to([3.9, 1.5, 0]),
            Text("每条线都是「真包含」", font_size=23, color=GRAY_A).move_to([3.9, 0.75, 0]),
        )
        divisor_rule = MathTex(r"d \mid 12 \;\Longleftrightarrow\; \exists\, |H| = d", font_size=42)
        divisor_rule.move_to([3.9, -0.9, 0])
        caption = Text("子群个数 = 正因子个数 = 6", font_size=25, color=YELLOW).move_to([3.9, -2.2, 0])

        self.play(Write(head), run_time=0.6)
        self.play(Create(links), run_time=0.9)
        self.play(LaggedStart(*[FadeIn(c) for c in circles], lag_ratio=0.12), run_time=1.2)
        self.play(Write(labels), run_time=0.9)
        self.play(Write(right_notes), run_time=0.8)
        self.play(Write(divisor_rule), run_time=0.8)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
