"""乘法群 (Z/7)*：谁是生成元，一眼看出阶

@expect 左右两个圆圈上同样摆着 1~6 六个元素。左边按「乘 2 取模 7」连箭头，走出两个互不相通的小环；右边按「乘 3 取模 7」连箭头，一根线串起全部六个元素最后回到起点。
@note 讲解要点：ord(2)=3、ord(3)=6——3 是本原根，(Z/7)* 由它单独生成。群论里「生成元」不是「能参与运算的元素」，而是「一个人就能把全群跑一遍的元素」，数量往往远少于群的大小。
"""

from manim import *
import math


class ModularMultiplicationScene(Scene):
    def construct(self):
        values = [1, 2, 3, 4, 5, 6]

        def position(center, v):
            ang = math.pi / 2 - (v - 1) * math.pi / 3
            return [center[0] + 1.95 * math.cos(ang), center[1] + 1.95 * math.sin(ang), 0]

        def build(center, gen, color):
            ring = Circle(radius=1.95, color=GRAY_B, stroke_width=2).move_to(center)
            nodes = VGroup(*[Dot(position(center, v), radius=0.09, color=WHITE) for v in values])
            labels = VGroup(
                *[
                    Text(str(v), font_size=26, color=color).move_to(
                        [
                            center[0] + 2.5 * math.cos(math.pi / 2 - (v - 1) * math.pi / 3),
                            center[1] + 2.5 * math.sin(math.pi / 2 - (v - 1) * math.pi / 3),
                            0,
                        ]
                    )
                    for v in values
                ]
            )
            arrows = VGroup(
                *[
                    Arrow(
                        position(center, v),
                        position(center, (v * gen) % 7),
                        color=color,
                        buff=0.18,
                        stroke_width=3,
                        max_tip_length_to_length_ratio=0.09,
                    )
                    for v in values
                ]
            )
            return VGroup(ring, arrows, nodes, labels)

        left = build([-3.6, -0.45, 0], 2, BLUE)
        right = build([3.6, -0.45, 0], 3, YELLOW)

        left_note = Text("×2 mod 7：两个 3-循环，ord(2)=3", font_size=25, color=BLUE)
        left_note.move_to([-3.6, -3.35, 0])
        right_note = Text("×3 mod 7：单个 6-循环，ord(3)=6", font_size=25, color=YELLOW)
        right_note.move_to([3.6, -3.35, 0])

        title = Text("生成元：一个人就能把整个群跑一遍", font_size=30).to_edge(UP, buff=0.3)
        caption = Text("3 是本原根——它的幂依次踩过 1~6 每一个非零元", font_size=25, color=GRAY_A)
        caption.move_to([0, 2.6, 0])

        self.play(Write(title), Write(caption), run_time=0.9)
        self.play(FadeIn(left[0]), FadeIn(left[2]), FadeIn(right[0]), FadeIn(right[2]), run_time=0.8)
        self.play(Write(left[3]), Write(right[3]), run_time=0.8)
        self.play(LaggedStart(*[Create(a) for a in left[1]], lag_ratio=0.12), run_time=1.3)
        self.play(Create(left_note), run_time=0.6)
        self.play(LaggedStart(*[Create(a) for a in right[1]], lag_ratio=0.12), run_time=1.6)
        self.play(Create(right_note), run_time=0.6)
        self.wait(0.4)
