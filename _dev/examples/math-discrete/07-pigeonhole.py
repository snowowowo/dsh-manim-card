"""鸽巢原理：13 只鸽子放进 12 个巢

@expect 12 个巢先各落一只鸽子，还剩一只无处可放；它落进第一个巢时被红圈标出——巢数已经用完，必然有一只和别的挤在一起。
@note 讲解要点：m 个巢装 n 只鸽子，必有某个巢至少装 ⌈n/m⌉ 只，靠的是「平均」而不是「构造」——假如每个巢都不到 ⌈n/m⌉ 只，总数就凑不到 n。这是抽屉原理、也是「哈希必冲突」的同一句话。
"""

from manim import *


class PigeonholeScene(Scene):
    def construct(self):
        holes = 12
        xs = [-5.5 + i * 1.0 for i in range(holes)]

        nests = VGroup()
        for x in xs:
            box = Square(side_length=0.82, color=GRAY_B, stroke_width=2).move_to([x, 0, 0])
            nests.add(box)

        hole_numbers = VGroup(
            *[Text(str(i + 1), font_size=20, color=GRAY_A).move_to([xs[i], -0.66, 0]) for i in range(holes)]
        )

        pigeons = VGroup()
        for x in xs:
            dot = Dot([x, 0, 0], radius=0.14, color=TEAL)
            pigeons.add(dot)

        extra = Dot([xs[0], 0, 0], radius=0.15, color=RED)
        ring = Circle(radius=0.34, color=RED, stroke_width=3)
        ring.move_to([xs[0], 0, 0])

        head = Text("12 个巢，先各放一只：正好用完", font_size=25, color=GREEN).move_to([0, 1.3, 0])
        tail = Text("第 13 只无论放进哪个巢，都会和已有的挤在一起", font_size=25, color=RED)
        tail.move_to([0, -2.0, 0])
        formula = MathTex(r"\left\lceil \frac{n}{m} \right\rceil = \left\lceil \frac{13}{12} \right\rceil = 2", font_size=46)
        formula.move_to([0, -2.9, 0])

        self.play(FadeIn(nests), Write(hole_numbers), run_time=0.9)
        self.play(LaggedStart(*[FadeIn(d) for d in pigeons], lag_ratio=0.08), run_time=1.4)
        self.play(Write(head), run_time=0.6)
        self.play(FadeIn(extra, shift=DOWN * 0.6), run_time=0.7)
        self.play(Create(ring), Write(tail), run_time=0.8)
        self.play(Write(formula), run_time=0.8)
        self.wait(0.4)
