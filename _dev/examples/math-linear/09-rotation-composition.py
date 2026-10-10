"""旋转矩阵的复合：转两次 30° 等于转一次 60°

@expect 网格与黄色方块先被转 30°、再转 30°，两次之后的姿态与「一次转 60°」（虚线参考）完全重合。
@note 讲解要点：矩阵乘法就是「先做右边那个、再做左边那个」，两个旋转矩阵乘起来还是旋转矩阵——
    这就是「矩阵乘法为什么这么定义」的动机。
"""

from manim import *
import math


class RotationCompositionScene(Scene):
    def construct(self):
        plane = NumberPlane(
            x_range=[-4, 4, 1],
            y_range=[-3, 3, 1],
            x_length=6.4,
            y_length=4.8,
            background_line_style={"stroke_color": GRAY_D, "stroke_width": 1},
        )
        block = Square(side_length=1.5, color=YELLOW, stroke_width=3).set_fill(YELLOW, 0.3)
        block.move_to([1.2, 0.9, 0])
        figure = VGroup(plane, block)

        half = math.pi / 6  # 30°
        r30 = [[math.cos(half), -math.sin(half)], [math.sin(half), math.cos(half)]]

        # 一次转 60° 的参考位置：虚线方块（手算角点）且外扩一圈，让「完全重合」可对照
        whole = math.pi / 3  # 60°
        target_center = [
            1.2 * math.cos(whole) - 0.9 * math.sin(whole),
            1.2 * math.sin(whole) + 0.9 * math.cos(whole),
            0,
        ]
        half_s = 0.75
        corners = []
        for sx in (-1, 1):
            for sy in (-1, 1):
                px, py = sx * half_s, sy * half_s
                corners.append([
                    target_center[0] + px * math.cos(whole) - py * math.sin(whole),
                    target_center[1] + px * math.sin(whole) + py * math.cos(whole),
                    0,
                ])
        ring = [0, 1, 3, 2]  # 角点环序
        target = VGroup(*[
            DashedLine(corners[ring[i]], corners[ring[(i + 1) % 4]], color=GRAY_B, stroke_width=2)
            for i in range(4)
        ]).scale(1.12)

        formula = MathTex(r"R_{30^\circ} \cdot R_{30^\circ} = R_{60^\circ}", font_size=42).move_to([0, 3.4, 0])
        note = Text("两次 30° 落在同一处", font_size=28, color=YELLOW).to_edge(DOWN, buff=0.45)

        self.play(Create(plane), FadeIn(target), Write(formula), run_time=1.0)
        self.play(FadeIn(block), run_time=0.4)
        self.play(ApplyMatrix(r30, VGroup(plane, block)), run_time=1.5)
        self.play(ApplyMatrix(r30, VGroup(plane, block)), run_time=1.5)
        self.play(Write(note), run_time=0.6)
        self.play(Flash(target, color=GRAY_A, line_length=0.25, flash_radius=1.2), run_time=0.8)
        self.wait(0.4)
