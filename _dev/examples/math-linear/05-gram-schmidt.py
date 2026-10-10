"""Gram–Schmidt：把第二个向量减掉它在第一个上的投影

@expect 绿色向量沿虚线滑到红色位置后，与蓝色向量成直角（交点处有直角符号）。
@note 讲解要点：正交化的动作只有一句「减掉投影」——余下的部分自动垂直于前者。
    这就是 QR 分解、正交基、乃至傅里叶系数一路复用的同一个动作。
"""

from manim import *


class GramSchmidtScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[-1.5, 2.8, 1],
            y_range=[-0.5, 2.8, 1],
            x_length=4.3,
            y_length=3.3,
            tips=False,
            axis_config={"color": GRAY_B},
        ).shift(LEFT * 1.8 + DOWN * 0.5)

        origin = ax.c2p(0, 0)
        v1_end = ax.c2p(2, 1)
        v2_end = ax.c2p(0.5, 2.2)
        # 投影 (a·b/a·a)a：a·b = 1 + 2.2 = 3.2，a·a = 5 → 0.64·(2,1) = (1.28, 0.64)
        proj_end = ax.c2p(1.28, 0.64)
        ortho_end = ax.c2p(0.5 - 1.28, 2.2 - 0.64)  # (-0.78, 1.56)

        v1 = Arrow(origin, v1_end, buff=0, color=BLUE, stroke_width=4)
        v2 = Arrow(origin, v2_end, buff=0, color=GREEN, stroke_width=4)
        proj = Arrow(origin, proj_end, buff=0, color=GRAY_A, stroke_width=3)
        ortho = Arrow(origin, ortho_end, buff=0, color=RED, stroke_width=4)
        slide = Arrow(ax.c2p(1.28, 0.64), ax.c2p(0.5 - 1.28 + 1.28, 2.2 - 0.64 + 0.64 - 0.0),
                      buff=0, color=GREEN, stroke_width=2)
        drop = DashedLine(v2_end, ax.c2p(1.28, 0.64), color=GRAY_B)
        mark = RightAngle(Line(origin, v1_end), Line(origin, ortho_end), length=0.2)

        formula = MathTex(r"\vec u_2 = \vec v_2 - \frac{\vec v_1\cdot\vec v_2}{\vec v_1\cdot\vec v_1}\vec v_1",
                          font_size=40).move_to([3.9, 1.2, 0])
        note = Text("减掉投影，剩下的就垂直了", font_size=26, color=RED).move_to([3.9, 0.1, 0])

        self.play(Create(ax), run_time=0.8)
        self.play(GrowArrow(v1), GrowArrow(v2), run_time=0.8)
        self.play(Create(drop), GrowArrow(proj), run_time=0.7)
        self.play(Write(formula), run_time=0.8)
        self.play(Create(slide), run_time=0.5)
        self.play(GrowArrow(ortho), Create(mark), run_time=0.9)
        self.play(Write(note), run_time=0.5)
        self.wait(0.4)
