"""期望：概率分布的「重心」，也是这根杠杆的支点

@expect 六个取值位置上立着高度正比于概率的方块，杠杆在正中间找到平衡——支点恰好落在加权平均 μ=3.6 处，而不是算术中心 3.5。
@note 讲解要点：期望就是「按概率加权后的平均位置」。概率大的取值把支点拉向自己，和物理杠杆完全同构——这也是期望才叫「均值」的原因。
"""

from manim import *


class ExpectationBalanceScene(Scene):
    def construct(self):
        faces = [1, 2, 3, 4, 5, 6]
        weights = [0.10, 0.15, 0.20, 0.25, 0.20, 0.10]
        mean = sum(f * w for f, w in zip(faces, weights))

        x_at = lambda face: -4.0 + (face - 1) * 1.6
        beam = Line([-5.2, 0, 0], [5.2, 0, 0], color=GRAY_B, stroke_width=6)

        blocks = VGroup()
        for face, w in zip(faces, weights):
            block = Rectangle(width=0.85, height=w * 9.0, color=BLUE)
            block.set_fill(BLUE, opacity=0.65)
            block.move_to([x_at(face), w * 9.0 / 2, 0])
            blocks.add(block)

        face_labels = VGroup()
        for face in faces:
            face_labels.add(
                Text(str(face), font_size=28, color=YELLOW).move_to([x_at(face), -0.45, 0])
            )

        weight_labels = VGroup()
        for face, w in zip(faces, weights):
            weight_labels.add(
                Text(f"{w:.2f}", font_size=20, color=GRAY_A).move_to([x_at(face), w * 9.0 + 0.3, 0])
            )

        pivot_x = x_at(mean)
        fulcrum = Triangle(color=RED).scale(0.45).move_to([pivot_x, -0.32, 0])
        pivot_label = Text("支点 = 期望 μ = 3.6", font_size=26, color=RED)
        pivot_label.next_to(fulcrum, DOWN, buff=0.35)

        # MathTex 定位用绝对坐标：to_edge 要读包围盒，包围盒由 KaTeX 异步量出，量出前是 NaN（时隐时现）
        formula = MathTex(r"\mu \;=\; \sum_i x_i\, p_i \;=\; 3.6", font_size=48).move_to([0, 3.3, 0])

        self.play(Write(formula), run_time=1.0)
        self.play(Create(beam), run_time=0.5)
        self.play(LaggedStart(*[FadeIn(b) for b in blocks], lag_ratio=0.1), run_time=1.4)
        self.play(Write(face_labels), Write(weight_labels), run_time=0.8)
        self.play(FadeIn(fulcrum), Write(pivot_label), run_time=0.8)
        self.play(Indicate(blocks[3], color=RED, scale_factor=1.06), run_time=0.6)
        self.wait(0.4)
