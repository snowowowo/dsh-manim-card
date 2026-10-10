"""最小生成树：按权重从小到大加边，成环的边就丢掉

@expect 六个顶点上先淡淡铺开全部 8 条带权边；随后按权重 1→8 依次判定——能被采纳的边亮成绿色（共 5 条，刚好把 6 个点连成一棵），会成环的边被判红并画成虚线。最终 5 条绿边总权重 19。
@note 讲解要点：Kruskal 的核心只有一句——「只要不成环就加」。n 个顶点的生成树恰好 n-1 条边，所以加够 5 条就停。贪心之所以最优，是因为最轻的那条边必定属于某棵最小生成树（割性质）。
"""

from manim import *


class SpanningTreeScene(Scene):
    def construct(self):
        coords = {
            1: [-4.8, 0.5],
            2: [-3.0, 1.9],
            3: [-3.0, -0.8],
            4: [-0.9, 1.3],
            5: [-0.9, -1.0],
            6: [1.0, 0.2],
        }

        # (端点, 端点, 权重, 是否被采纳)
        specs = [
            (1, 2, 1, True),
            (1, 3, 2, True),
            (2, 3, 3, False),
            (2, 4, 4, True),
            (3, 5, 5, True),
            (4, 5, 6, False),
            (4, 6, 7, True),
            (5, 6, 8, False),
        ]

        def point(v):
            return [coords[v][0], coords[v][1], 0]

        ghost_edges = VGroup(
            *[Line(point(a), point(b), color=GRAY_D, stroke_width=2) for a, b, _, _ in specs]
        )

        background = VGroup()
        for v, (x, y) in coords.items():
            disc = Circle(radius=0.26, color=BLUE)
            disc.set_fill(BLUE, opacity=0.8)
            disc.move_to([x, y, 0])
            background.add(disc)
            background.add(Text(str(v), font_size=22, color=WHITE).move_to([x, y, 0]))

        weight_labels = VGroup()
        for a, b, w, _ in specs:
            mid = [(coords[a][0] + coords[b][0]) / 2, (coords[a][1] + coords[b][1]) / 2, 0]
            weight_labels.add(Text(str(w), font_size=20, color=GRAY_A).move_to([mid[0], mid[1] + 0.22, 0]))

        accepted = VGroup()
        rejected = VGroup()
        step_notes = VGroup()
        for idx, (a, b, w, ok) in enumerate(specs):
            if ok:
                accepted.add(Line(point(a), point(b), color=GREEN, stroke_width=4))
            else:
                rejected.add(DashedLine(point(a), point(b), color=RED, stroke_width=3))
            step_notes.add(
                Text(
                    f"{w}：{a}-{b} " + ("采纳" if ok else "成环，丢弃"),
                    font_size=22,
                    color=GREEN if ok else RED,
                ).move_to([4.7, 2.2 - idx * 0.52, 0])
            )

        head = Text("最小生成树 = n−1 条边 · 总权重 1+2+4+5+7 = 19", font_size=25, color=GREEN)
        head.move_to([0, 3.1, 0])
        caption = Text("Kruskal：按权重升序扫，不成环就加；加满 n−1 条即停", font_size=24, color=GRAY_A)
        caption.move_to([0, -3.2, 0])

        self.play(Write(head), run_time=0.6)
        self.play(Create(ghost_edges), FadeIn(background), Write(weight_labels), run_time=1.0)
        self.play(LaggedStart(*[Create(e) for e in accepted], lag_ratio=0.35), run_time=2.0)
        self.play(LaggedStart(*[Create(e) for e in rejected], lag_ratio=0.3), run_time=1.0)
        self.play(Write(step_notes), run_time=1.2)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
