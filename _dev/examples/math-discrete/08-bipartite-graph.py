"""二分图：顶点能分成两组、边只在组间出现

@expect 左边六个顶点分成蓝、黄两列，六条边全部从蓝列跨到黄列，同列内部一条边都没有；右侧对照画着一个三角形——三条边首尾相接构成的奇环。
@note 讲解要点：二分图的定义就是「顶点能二分类，使每条边的两端分属不同类」，等价于「图中没有奇环」。所以一个三角形就足以否决整个二分性；这也是判断二分图的染色算法能一行写完的原因。
"""

from manim import *
import math


class BipartiteGraphScene(Scene):
    def construct(self):
        left_x = -4.7
        right_x = -1.5
        ys = [1.5, 0.0, -1.5]

        def disc_at(x, y, color):
            disc = Circle(radius=0.27, color=WHITE, stroke_width=2)
            disc.set_fill(color, opacity=0.92)
            disc.move_to([x, y, 0])
            return disc

        left_discs = VGroup()
        left_nums = VGroup()
        right_discs = VGroup()
        right_nums = VGroup()
        for idx, y in enumerate(ys):
            left_discs.add(disc_at(left_x, y, BLUE))
            left_nums.add(Text(str(idx + 1), font_size=20, color=WHITE).move_to([left_x, y, 0]))
            right_discs.add(disc_at(right_x, y, YELLOW))
            right_nums.add(Text(str(idx + 4), font_size=20, color=WHITE).move_to([right_x, y, 0]))

        links = [
            (0, 0),
            (0, 1),
            (1, 1),
            (1, 2),
            (2, 0),
            (2, 2),
        ]
        edges = VGroup()
        for a, b in links:
            edges.add(
                Line(
                    [left_x, ys[a], 0],
                    [right_x, ys[b], 0],
                    color=GRAY_B,
                    stroke_width=3,
                )
            )

        # SurroundingRectangle 会「吃掉」被量的那组（之后不再渲染）——必须量副本
        left_box = SurroundingRectangle(left_discs.copy())
        left_box.set_color(BLUE)
        left_box.set_stroke(width=2)
        right_box = SurroundingRectangle(right_discs.copy())
        right_box.set_color(YELLOW)
        right_box.set_stroke(width=2)

        side_labels = VGroup(
            Text("一组 U", font_size=24, color=BLUE).move_to([left_x, 2.45, 0]),
            Text("另一组 V", font_size=24, color=YELLOW).move_to([right_x, 2.45, 0]),
        )
        ok_note = Text("同组内部没有边 → 是二分图", font_size=24, color=GREEN).move_to([-3.1, -2.5, 0])

        tri_center = [3.5, 0.3]
        tri_radius = 1.25
        tri_points = []
        for i in range(3):
            ang = math.pi / 2 + i * 2 * math.pi / 3
            tri_points.append(
                [tri_center[0] + tri_radius * math.cos(ang), tri_center[1] + tri_radius * math.sin(ang), 0]
            )
        tri_edges = VGroup(
            *[Line(tri_points[i], tri_points[(i + 1) % 3], color=RED, stroke_width=3) for i in range(3)]
        )
        tri_dots = VGroup(*[Dot(p, radius=0.14, color=WHITE) for p in tri_points])
        tri_note = Text("奇环（三角形）→ 不是二分图", font_size=24, color=RED).move_to([3.5, -2.5, 0])

        head = Text("二分图：顶点分两组，边只跨组", font_size=27, color=YELLOW).move_to([0, 3.2, 0])
        caption = Text("二分图 ⇔ 不含奇环：找到奇环就能立刻否决", font_size=24, color=GRAY_A)
        caption.move_to([0, -3.3, 0])

        self.play(Write(head), run_time=0.6)
        self.play(Create(edges), run_time=0.9)
        self.play(LaggedStart(*[FadeIn(d) for d in left_discs], lag_ratio=0.15), run_time=0.9)
        self.play(LaggedStart(*[FadeIn(d) for d in right_discs], lag_ratio=0.15), run_time=0.9)
        self.play(Write(left_nums), Write(right_nums), run_time=0.7)
        self.play(Create(left_box), Create(right_box), Write(side_labels), run_time=0.8)
        self.play(Write(ok_note), run_time=0.6)
        self.play(Create(tri_edges), FadeIn(tri_dots), run_time=0.9)
        self.play(Write(tri_note), run_time=0.6)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
