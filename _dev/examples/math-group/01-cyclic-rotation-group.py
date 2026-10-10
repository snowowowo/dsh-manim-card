"""循环群 C4：正方形旋转 4 次回到原样

@expect 四个正方形排成一行，红点标记「被跟踪的那个角」：每次逆时针转 90°，红点依次走到四个角；R90 连着做两次正好落在 R180 上，R270 再转一次回到 R0。
@note 讲解要点：C4 = {e, r, r², r³} 里真正独立的只有 4 个元素，r⁴ = e。这就是「有限群」的样子——做下去不会跑出有限的几个状态，而是绕回原点。
"""

from manim import *
import math


class CyclicRotationGroupScene(Scene):
    def construct(self):
        side = 1.7
        half = side / 2
        corner = [half, half * 0.35]
        xs = [-4.7, -1.57, 1.57, 4.7]
        names = ["R0 = e", "R90", "R180", "R270"]

        headings = VGroup(
            *[Text(n, font_size=26, color=YELLOW).move_to([x, 2.6, 0]) for x, n in zip(xs, names)]
        )

        states = VGroup()
        marks = []
        for idx, x in enumerate(xs):
            ang = idx * math.pi / 2
            square = Square(side_length=side, color=BLUE).move_to([x, 1.2, 0])
            dx = corner[0] * math.cos(ang) - corner[1] * math.sin(ang)
            dy = corner[0] * math.sin(ang) + corner[1] * math.cos(ang)
            arm = Line([x, 1.2, 0], [x + dx, 1.2 + dy, 0], color=GRAY_A, stroke_width=2)
            mark = Dot([x + dx, 1.2 + dy, 0], radius=0.11, color=RED)
            states.add(VGroup(square, arm, mark))
            marks.append(mark)  # 要单独点名某个物体时，另存一份普通 list，别靠 VGroup 下标

        steps = VGroup()
        for i in range(3):
            steps.add(Arrow([xs[i] + half + 0.12, 1.2, 0], [xs[i + 1] - half - 0.12, 1.2, 0], color=GREEN, buff=0))
        step_label = Text("再转 90°", font_size=22, color=GREEN).move_to([0, 0.0, 0])

        wrap = VGroup(
            Line([xs[3], 0.2, 0], [xs[3], -0.75, 0], color=GREEN, stroke_width=2.5),
            Line([xs[3], -0.75, 0], [xs[0], -0.75, 0], color=GREEN, stroke_width=2.5),
        )
        wrap_arrow = Arrow([-1.4, -0.75, 0], [xs[0], -0.75, 0], color=GREEN, buff=0)
        wrap_label = Text("转满 4 次回到 e", font_size=22, color=GREEN).move_to([0, -1.35, 0])

        formula = MathTex(r"C_4 = \{e,\ r,\ r^2,\ r^3\},\qquad r^4 = e", font_size=46)
        formula.to_edge(UP, buff=0.3)

        self.play(Write(formula), run_time=0.8)
        self.play(LaggedStart(*[FadeIn(s) for s in states], lag_ratio=0.18), run_time=1.6)
        self.play(Write(headings), run_time=0.7)
        self.play(LaggedStart(*[Create(a) for a in steps], lag_ratio=0.25), Write(step_label), run_time=1.2)
        self.play(Create(wrap), Create(wrap_arrow), Write(wrap_label), run_time=1.0)
        # 强调某一态用 Flash（只往画面上加临时线，不碰物体本身）——
        # Indicate 会把组里的描边/填充改残（实测 R180 的方框被冲白、红点消失）
        self.play(Flash(marks[2], color=RED, line_length=0.32), run_time=0.7)
        self.wait(0.4)
