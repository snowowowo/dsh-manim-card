"""正交投影：b 在 a 上的影子

@expect 从 b 的末端落一条虚线垂直打到 a 直线上，交点处有个直角符号；黄色箭头就是投影向量。
@note 讲解要点：投影 = 「沿 a 方向能解释多少 b，剩下的部分与 a 垂直」。
    直角符号是关键——投影的余项一定垂直于 a，最小二乘、正交基都从这条性质长出来。
"""

from manim import *


class OrthogonalProjectionScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[-0.5, 4, 1],
            y_range=[-0.5, 3, 1],
            x_length=4.5,
            y_length=3.5,
            tips=False,
            axis_config={"color": GRAY_B},
        ).shift(LEFT * 1.6 + DOWN * 0.5)

        a_end = ax.c2p(3, 1)
        b_end = ax.c2p(0.8, 2.4)
        # proj = (a·b/|a|²) a = 0.48 a = (1.44, 0.48)
        proj_end = ax.c2p(1.44, 0.48)

        vec_a = Arrow(ax.c2p(0, 0), a_end, buff=0, color=BLUE, stroke_width=4)
        vec_b = Arrow(ax.c2p(0, 0), b_end, buff=0, color=GREEN, stroke_width=4)
        vec_p = Arrow(ax.c2p(0, 0), proj_end, buff=0, color=YELLOW, stroke_width=5)
        drop = DashedLine(b_end, proj_end, color=GRAY_A)
        mark = RightAngle(Line(ax.c2p(0, 0), proj_end), Line(proj_end, b_end), length=0.22)

        label_a = MathTex(r"\vec a", color=BLUE, font_size=36).next_to(vec_a, DOWN, buff=0.15)
        label_b = MathTex(r"\vec b", color=GREEN, font_size=36).next_to(vec_b, UP, buff=0.15)
        formula = MathTex(
            r"\mathrm{proj}_{\vec a}\vec b = \frac{\vec a\cdot\vec b}{\vec a\cdot\vec a}\,\vec a",
            font_size=40,
        ).move_to([4.0, 1.0, 0])
        note = Text("余项与 a 垂直", font_size=26, color=GRAY_A).move_to([4.0, 0.0, 0])

        self.play(Create(ax), run_time=0.8)
        self.play(GrowArrow(vec_a), GrowArrow(vec_b), Write(label_a), Write(label_b), run_time=1.0)
        self.play(Write(formula), run_time=0.8)
        self.play(Create(drop), Create(mark), run_time=0.7)
        self.play(GrowArrow(vec_p), run_time=0.8)
        self.play(Write(note), run_time=0.5)
        self.wait(0.4)
