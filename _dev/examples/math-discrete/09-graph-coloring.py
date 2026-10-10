"""图着色：相邻顶点不能同色，最少要几种

@expect 左边 5 个顶点连成一个奇数环，只用红蓝两色会在闭合处撞色，于是必须动用第三种颜色（绿）；右边 4 个顶点两两相连，无论怎么排都得用满四种颜色。
@note 讲解要点：色数 χ(G) 是「最少几种颜色」。奇数环 χ=3、偶数环 χ=2——差一个顶点就差一种颜色。两两相邻的完全图 Kn 必须 n 色，这是下界；四色定理则保证平面图 4 色永远够用。
"""

from manim import *
import math


class GraphColoringScene(Scene):
    def construct(self):
        # 左：5 环（奇环）——两色不够，需要 3 色
        c5_center = [-3.8, 0.1]
        c5_radius = 1.7
        c5_points = []
        for i in range(5):
            ang = math.pi / 2 + i * 2 * math.pi / 5
            c5_points.append([c5_center[0] + c5_radius * math.cos(ang), c5_center[1] + c5_radius * math.sin(ang), 0])
        c5_colors = [RED, BLUE, RED, BLUE, GREEN]

        c5_edges = VGroup(
            *[
                Line(c5_points[i], c5_points[(i + 1) % 5], color=GRAY_B, stroke_width=3)
                for i in range(5)
            ]
        )
        c5_vertices = VGroup()
        for point, color in zip(c5_points, c5_colors):
            disc = Circle(radius=0.3, color=WHITE, stroke_width=2)
            disc.set_fill(color, opacity=0.9)
            disc.move_to(point)
            c5_vertices.add(disc)

        c5_note = Text("C5：奇环 → 至少 3 色", font_size=24, color=GREEN).move_to([-3.8, -2.35, 0])

        # 右：K4——两两相邻，必须 4 色
        k4_center = [3.5, 0.1]
        k4_points = [[k4_center[0], k4_center[1], 0]]
        for i in range(3):
            ang = math.pi / 2 + i * 2 * math.pi / 3
            k4_points.append(
                [k4_center[0] + 1.5 * math.cos(ang), k4_center[1] + 1.5 * math.sin(ang), 0]
            )
        k4_colors = [YELLOW, RED, BLUE, GREEN]

        k4_edges = VGroup()
        for i in range(4):
            for j in range(i + 1, 4):
                k4_edges.add(Line(k4_points[i], k4_points[j], color=GRAY_B, stroke_width=3))

        k4_vertices = VGroup()
        for point, color in zip(k4_points, k4_colors):
            disc = Circle(radius=0.3, color=WHITE, stroke_width=2)
            disc.set_fill(color, opacity=0.9)
            disc.move_to(point)
            k4_vertices.add(disc)

        k4_note = Text("K4：两两相邻 → 必须 4 色", font_size=24, color=YELLOW).move_to([3.5, -2.35, 0])

        head = Text("图着色：相邻顶点不能同色，最少要几种", font_size=27, color=YELLOW).move_to([0, 3.2, 0])
        caption = Text("χ(C5) = 3，χ(K4) = 4；四色定理保证平面图 χ ≤ 4", font_size=24, color=GRAY_A)
        caption.move_to([0, -3.25, 0])

        self.play(Write(head), run_time=0.6)
        self.play(Create(c5_edges), Create(k4_edges), run_time=1.0)
        self.play(LaggedStart(*[FadeIn(v) for v in c5_vertices], lag_ratio=0.18), run_time=1.2)
        self.play(Write(c5_note), run_time=0.6)
        self.play(LaggedStart(*[FadeIn(v) for v in k4_vertices], lag_ratio=0.18), run_time=1.2)
        self.play(Write(k4_note), run_time=0.6)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
