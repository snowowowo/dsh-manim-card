"""条件概率：换一个样本空间重新归一化

@expect 事件 A 被 B 的边界切成两半，先点亮落在 B 里的那一半；随后 B 之外的部分整体压暗，只剩 B 内部重新按比例摊开。
@note 讲解要点：P(A|B) 的分母从 Ω 换成了 B——不是给 A 打折扣，而是「已知 B 发生」之后把概率全部压回 B 内部重新分配。
"""

from manim import *


class ConditionalProbabilityScene(Scene):
    def construct(self):
        omega = Rectangle(width=5.0, height=5.0, color=GRAY_B).move_to([0, -0.5, 0])
        omega.set_fill(GRAY_E, opacity=0.3)

        b_box = Rectangle(width=3.0, height=3.0, color=YELLOW).move_to([-1.0, -1.5, 0])
        b_box.set_fill(YELLOW, opacity=0.22)

        a_inside = Rectangle(width=2.0, height=2.0, color=RED).move_to([-0.5, -1.0, 0])
        a_outside = Rectangle(width=1.0, height=2.0, color=BLUE).move_to([1.0, -1.0, 0])
        a_inside.set_fill(RED, opacity=0.6)
        a_outside.set_fill(BLUE, opacity=0.6)

        label_a = Text("A", font_size=28, color=BLUE).move_to([1.9, 0.1, 0])
        label_b = Text("B", font_size=28, color=YELLOW).move_to([-2.2, 0.1, 0])
        label_ab = MathTex(r"A\cap B", font_size=36, color=WHITE).move_to([-0.5, -1.0, 0])

        formula = MathTex(
            r"P(A\mid B) = \frac{P(A\cap B)}{P(B)} = \frac{0.16}{0.36} \approx 0.44",
            font_size=40,
        ).to_edge(UP, buff=0.35)

        self.play(Create(omega), run_time=0.6)
        self.play(Write(formula), run_time=0.8)
        self.play(Create(a_outside), Create(a_inside), Write(label_a), run_time=0.8)
        self.play(Create(b_box), Write(label_b), run_time=0.7)
        self.play(Write(label_ab), Indicate(a_inside, color=WHITE, scale_factor=1.05), run_time=0.8)
        self.play(
            a_outside.animate.set_opacity(0.12),
            a_inside.animate.set_opacity(1.0),
            omega.animate.set_opacity(0.25),
            b_box.animate.set_opacity(1.0),
            label_a.animate.set_opacity(0.15),
            run_time=1.0,
        )
        self.wait(0.4)
