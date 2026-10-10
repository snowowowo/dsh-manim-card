"""概率的加法公式（容斥）：P(A∪B) = P(A) + P(B) - P(A∩B)

@expect 样本空间 Ω 里两个半透明矩形事件 A、B 相互交叠，重叠区由两层填色混出中间色；A∩B 用红色描边框单独点亮并标注字母，再回到公式里说明它刚好是被重复计入的那一份。
@note 讲解要点：容斥公式的「减一次交集」不是凑出来的修正项——P(A)+P(B) 把 A∩B 里的概率计了两遍，减掉它才算不重不漏。
"""

from manim import *


class InclusionExclusionScene(Scene):
    def construct(self):
        space = Rectangle(width=8.2, height=3.6, color=GRAY_B).move_to([0, 0.25, 0])
        space.set_fill(GRAY_E, opacity=0.35)

        a_box = Rectangle(width=4.6, height=2.6, color=BLUE).move_to([-1.5, 0.25, 0])
        b_box = Rectangle(width=4.6, height=2.6, color=YELLOW).move_to([1.5, 0.25, 0])
        inter = Rectangle(width=1.6, height=2.6, color=RED).move_to([0, 0.25, 0])
        a_box.set_fill(BLUE, opacity=0.35)
        b_box.set_fill(YELLOW, opacity=0.35)
        inter = Rectangle(width=1.6, height=2.6, color=RED, stroke_width=3).move_to([0, 0.25, 0])

        label_omega = Text("Ω 样本空间", font_size=24, color=GRAY_A).next_to(space, UL, buff=0.14)
        label_a = Text("A", font_size=30, color=BLUE).move_to([-3.2, 1.25, 0])
        label_b = Text("B", font_size=30, color=YELLOW).move_to([3.2, 1.25, 0])
        label_inter = Text("A∩B", font_size=26, color=RED).move_to([0, -0.55, 0])

        formula = MathTex(r"P(A\cup B) = P(A) + P(B) - P(A\cap B)", font_size=44).to_edge(UP, buff=0.3)
        caption = Text(
            "P(A)+P(B) 把中间那块算了两遍，所以减一次",
            font_size=26,
        ).to_edge(DOWN, buff=0.4)

        self.play(Create(space), Write(label_omega), run_time=0.8)
        self.play(Write(formula), run_time=0.8)
        self.play(Create(a_box), Create(b_box), Write(label_a), Write(label_b), run_time=1.0)
        self.play(Create(inter), Write(label_inter), run_time=0.6)
        self.play(Circumscribe(inter, color=WHITE, stroke_width=3), run_time=0.9)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
