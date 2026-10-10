"""数学归纳法的经典图示：两段阶梯拼成一个矩形

@expect 左边蓝色阶梯的柱高依次是 1、2、3、4，右边黄色阶梯柱高 4、3、2、1；两块交错拼合后正好填满一个宽 4、高 5 的矩形——所以阶梯的总格子数是 4×5 的一半。
@note 讲解要点：归纳法的两块拼图缺一不可——「基例」保证第一块砖立在原地（n=1 成立），「归纳步」保证倒下一块就带倒下一块（n 成立则 n+1 成立）。而这张图给出的是结论的闭式：1+2+…+n = n(n+1)/2。
"""

from manim import *


class MathematicalInductionScene(Scene):
    def construct(self):
        n = 4
        unit = 0.72
        x_left = -5.0
        y_bottom = -2.2

        def cell(j, k):
            return [
                x_left + unit * (j + 0.5),
                y_bottom + unit * (k + 0.5),
                0,
            ]

        lower = VGroup()
        upper = VGroup()
        for j in range(n):
            for k in range(j + 1):
                box = Square(side_length=unit * 0.97, color=BLUE)
                box.set_fill(BLUE, opacity=0.75)
                box.move_to(cell(j, k))
                lower.add(box)
            for k in range(j + 1, n + 1):
                box = Square(side_length=unit * 0.97, color=YELLOW)
                box.set_fill(YELLOW, opacity=0.75)
                box.move_to(cell(j, k))
                upper.add(box)

        outline = Rectangle(width=unit * n, height=unit * (n + 1), color=WHITE)
        outline.move_to([x_left + unit * n / 2, y_bottom + unit * (n + 1) / 2, 0])

        leg_lower = Text("1 + 2 + 3 + 4", font_size=24, color=BLUE).move_to([x_left + unit * n / 2, y_bottom - 0.42, 0])
        leg_upper = Text("4 + 3 + 2 + 1", font_size=24, color=YELLOW).move_to([x_left + unit * n / 2 + 2.4, y_bottom - 0.42, 0])

        right_x = 2.4
        formula = MathTex(r"1 + 2 + \cdots + n = \frac{n(n+1)}{2}", font_size=46)
        formula.move_to([right_x, 1.5, 0])
        step1 = Text("两块阶梯拼成 4 × 5 的矩形", font_size=24, color=WHITE).move_to([right_x, 0.35, 0])
        step2 = MathTex(r"1+2+3+4 = \frac{4 \times 5}{2} = 10", font_size=42, color=GREEN)
        step2.move_to([right_x, -0.8, 0])
        note = Text("基例管「第一块砖」，归纳步管「倒下一块带倒下一块」", font_size=23, color=GRAY_A)
        note.move_to([right_x, -2.1, 0])
        caption = Text("两条腿都成立，整条链就都成立", font_size=25, color=YELLOW).move_to([right_x, -2.9, 0])

        self.play(LaggedStart(*[FadeIn(b) for b in lower], lag_ratio=0.08), run_time=1.4)
        self.play(Write(leg_lower), run_time=0.5)
        self.play(LaggedStart(*[FadeIn(b) for b in upper], lag_ratio=0.08), run_time=1.4)
        self.play(Write(leg_upper), Create(outline), run_time=0.7)
        self.play(Write(formula), run_time=0.8)
        self.play(Write(step1), run_time=0.6)
        self.play(Write(step2), run_time=0.8)
        self.play(Write(note), run_time=0.7)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
