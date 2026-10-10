"""置换的复合：先做谁、后做谁，结果不一样

@expect 四行三格的球位，上两行把「先 σ 后 τ」一步步做出来，最下一行换成「先 τ 后 σ」；两行终态的颜色排列明显不同——同一个集合、同一个运算，交换顺序就换了答案。
@note 讲解要点：置换群 S3 是最小的非交换群。σ 是三轮换、τ 是对换，τ∘σ ≠ σ∘τ，这就是「不对称（非交换）」的入门例子，也是矩阵乘法不可交换的同源现象。
"""

from manim import *


class PermutationCompositionScene(Scene):
    def construct(self):
        slots = [-2.2, 0.0, 2.2]
        ball_r = 0.34
        rows = [2.0, 0.8, -0.45, -2.1]

        def make_row(y, palette, row_label, highlight=False):
            group = VGroup()
            for x, color in zip(slots, palette):
                ball = Circle(radius=ball_r, color=WHITE if not highlight else YELLOW)
                ball.set_fill(color, opacity=0.85)
                ball.move_to([x, y, 0])
                group.add(ball)
            tag = Text(row_label, font_size=24, color=YELLOW if highlight else GRAY_A)
            tag.move_to([-4.9, y, 0])
            return VGroup(group, tag)

        start = [RED, GREEN, BLUE]
        after_sigma = [BLUE, RED, GREEN]
        tau_then_sigma = [RED, BLUE, GREEN]
        sigma_then_tau = [BLUE, GREEN, RED]

        row1 = make_row(rows[0], start, "起始")
        row2 = make_row(rows[1], after_sigma, "先做 σ（三轮换）")
        row3 = make_row(rows[2], tau_then_sigma, "再做 τ（对换 1↔2）", highlight=True)
        row4 = make_row(rows[3], sigma_then_tau, "改成先 τ 后 σ", highlight=True)

        # 公式定位用绝对坐标，不用 to_edge——MathTex 的包围盒要等 KaTeX 量出来，
        # 量出来之前 to_edge / next_to 会按 NaN 算，整条被挪出画框（干跑查不出，退出码还是 0）
        formula = MathTex(
            r"\tau \circ \sigma \neq \sigma \circ \tau",
            font_size=44,
            color=RED,
        ).move_to([0, 3.35, 0])

        caption = Text("结果不同 → S3 是交换群吗？不是。这是最小的非交换群", font_size=24, color=GRAY_A)
        caption.move_to([0, 2.62, 0])

        compare = Text("两行终态不一样", font_size=26, color=RED).move_to([5.1, rows[2], 0])
        compare2 = Text("（交换律失效）", font_size=24, color=GRAY_A).move_to([5.1, rows[3], 0])

        self.play(Write(formula), Write(caption), run_time=0.9)
        self.play(FadeIn(row1), run_time=0.7)
        self.play(FadeIn(row2), run_time=0.7)
        self.play(FadeIn(row3), run_time=0.7)
        self.play(FadeIn(row4), run_time=0.7)
        self.play(Write(compare), Write(compare2), run_time=0.8)
        self.wait(0.4)
