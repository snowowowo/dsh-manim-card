"""轨道与稳定子：一个点被群推到哪些地方，谁又让它原地不动

@expect 左边正方形上，顶点 1 被群作用推到 2、3、4 三个位置（三条绿色箭头，顶点为黄色）——轨道有 4 个点；右下两个小正方形画的是让顶点 1 不动的两个对称（恒等、沿对角线镜像）。轨道数 × 稳定子数正好等于群的大小。
@note 讲解要点：轨道是「能被推到的地方」，稳定子是「推了也不动的变换」。同一个群作用在不同东西上，轨道会变、稳定子也会变。G 作用在 4 个顶点上时 |G| = 8 = 4 × 2；作用在中心上时轨道只有 1 个、稳定子是全群 8 个，乘积依然是 8。
"""

from manim import *


class OrbitStabilizerScene(Scene):
    def construct(self):
        side = 3.0
        center = [-3.9, 0.35, 0]
        half = side / 2
        corner_offsets = [
            [half, half, "1"],
            [-half, half, "2"],
            [-half, -half, "3"],
            [half, -half, "4"],
        ]
        corners = [
            [center[0] + dx, center[1] + dy, 0] for dx, dy, _ in corner_offsets
        ]

        square = Square(side_length=side, color=BLUE).move_to(center)
        vertex_dots = VGroup(*[Dot(p, radius=0.13, color=YELLOW) for p in corners])
        vertex_labels = VGroup(
            *[
                Text(name, font_size=24, color=YELLOW).move_to(
                    [p[0] + (0.32 if dx > 0 else -0.32), p[1] + (0.3 if dy > 0 else -0.32), 0]
                )
                for p, (dx, dy, name) in zip(corners, corner_offsets)
            ]
        )

        orbit_arrows = VGroup(
            *[
                Arrow(corners[0], corners[i], color=GREEN, buff=0.24, stroke_width=2.5,
                      max_tip_length_to_length_ratio=0.08)
                for i in (1, 2, 3)
            ]
        )
        orbit_label = Text("轨道：{1,2,3,4}，4 个点", font_size=25, color=GREEN).move_to([-3.9, -2.4, 0])

        def mini_square(at, axis, caption):
            s = 1.7
            h = s / 2
            box = Square(side_length=s, color=BLUE).move_to(at)
            dots = VGroup(
                *[
                    Dot([at[0] + dx, at[1] + dy, 0], radius=0.08, color=YELLOW)
                    for dx, dy in [(h, h), (-h, h), (-h, -h), (h, -h)]
                ]
            )
            fixed = Dot([at[0] + h, at[1] + h, 0], radius=0.16, color=RED)
            line = None
            if axis == "diag":
                line = DashedLine([at[0] - h, at[1] - h, 0], [at[0] + h, at[1] + h, 0], color=YELLOW)
            text = Text(caption, font_size=21, color=GRAY_A).move_to([at[0], at[1] - 1.45, 0])
            group = VGroup(box, dots, fixed)
            if line is not None:
                group.add(line)
            return VGroup(group, text)

        stab1 = mini_square([1.2, 0.9, 0], "none", "恒等：什么都不动")
        stab2 = mini_square([4.4, 0.9, 0], "diag", "沿对角线镜像：1 与 3 不动")
        stab_label = Text("稳定子：让顶点 1 不动的有 2 个", font_size=24, color=RED).move_to([2.8, -1.35, 0])

        formula = MathTex(
            r"|G| = |\mathrm{Orb}(x)| \times |\mathrm{Stab}(x)| \qquad 8 = 4 \times 2",
            font_size=38,
        ).move_to([0, 3.35, 0])

        self.play(Write(formula), run_time=0.9)
        self.play(Create(square), FadeIn(vertex_dots), Write(vertex_labels), run_time=0.9)
        self.play(LaggedStart(*[Create(a) for a in orbit_arrows], lag_ratio=0.25), run_time=1.1)
        self.play(Write(orbit_label), run_time=0.6)
        self.play(FadeIn(stab1), FadeIn(stab2), run_time=0.9)
        self.play(Write(stab_label), run_time=0.7)
        self.wait(0.4)
