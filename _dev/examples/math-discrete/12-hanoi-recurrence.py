"""汉诺塔的递推：T(n) = 2T(n−1) + 1，所以是 2ⁿ − 1

@expect 左下画着三根柱子，最左边那根垒着从小到大的三个盘子；右边的柱状图给出 n=1 到 8 的步数。柱子高度是按 log₂(T+1) 等比缩放的，所以画面上的高度恰好等距上升——一条完美的直线，代表的是货真价实的指数增长。
@note 讲解要点：把上面 n−1 个盘子搬走要 T(n−1) 步，搬最大的那个 1 步，再把 n−1 个搬回来又 T(n−1) 步，于是 T(n) = 2T(n−1)+1，展开就是 2ⁿ−1。64 个盘子的经典题目需要 1.8×10¹⁹ 步——按每秒一步要五百多亿年。
"""

from manim import *


class HanoiRecurrenceScene(Scene):
    def construct(self):
        # 左下：三根柱子与三个盘子
        base = Line([-6.6, -2.5, 0], [-1.4, -2.5, 0], color=GRAY_B, stroke_width=4)
        pegs = VGroup()
        peg_names = VGroup()
        for idx, x in enumerate([-5.9, -4.2, -2.5]):
            pegs.add(Line([x, -2.5, 0], [x, -0.5, 0], color=GRAY_B, stroke_width=3))
            peg_names.add(Text(["A", "B", "C"][idx], font_size=22, color=GRAY_A).move_to([x, -2.85, 0]))

        widths = [2.2, 1.6, 1.0]
        colors = [BLUE, GREEN, RED]
        disks = VGroup()
        for idx, (w, color) in enumerate(zip(widths, colors)):
            disk = Rectangle(width=w, height=0.42, color=WHITE)
            disk.set_fill(color, opacity=0.85)
            disk.move_to([-5.9, -2.29 + idx * 0.46, 0])
            disks.add(disk)

        peg_note = Text("n 个盘子：2ⁿ − 1 步", font_size=23, color=YELLOW).move_to([-4.0, 0.0, 0])

        # 右侧：按 log2 缩放的柱状图
        ns = list(range(1, 9))
        moves = [2 ** n - 1 for n in ns]
        base_y = -2.4
        max_h = 4.3
        peak = float(max(ns))

        bars = VGroup()
        tops = VGroup()
        bottoms = VGroup()
        for idx, (n, mv) in enumerate(zip(ns, moves)):
            x = -0.3 + idx * 0.95
            height = n / peak * max_h
            bar = Rectangle(width=0.62, height=height, color=BLUE)
            bar.set_fill(BLUE, opacity=0.75)
            bar.move_to([x, base_y + height / 2, 0])
            bars.add(bar)
            tops.add(Text(str(mv), font_size=17, color=YELLOW).move_to([x, base_y + height + 0.3, 0]))
            bottoms.add(Text(f"n={n}", font_size=15, color=GREEN).move_to([x, base_y - 0.34, 0]))

        bar_axis = Line([-0.9, base_y, 0], [6.9, base_y, 0], color=GRAY_B, stroke_width=3)
        log_note = Text("高度按 log₂(T+1) 画 → 看起来是直线", font_size=22, color=GRAY_A)
        log_note.move_to([3.0, 2.6, 0])

        formula = MathTex(r"T(n) = 2\,T(n-1) + 1 \;\Longrightarrow\; T(n) = 2^n - 1", font_size=40)
        formula.move_to([0, 3.3, 0])
        caption = Text("指数增长的「直线」——因为它本来就画在对数尺上", font_size=23, color=GRAY_A)
        caption.move_to([0, -3.3, 0])

        self.play(Write(formula), run_time=0.9)
        self.play(Create(base), Create(pegs), Write(peg_names), run_time=0.8)
        self.play(LaggedStart(*[FadeIn(d) for d in disks], lag_ratio=0.25), run_time=1.0)
        self.play(Write(peg_note), run_time=0.6)
        self.play(Create(bar_axis), Write(log_note), run_time=0.7)
        self.play(LaggedStart(*[FadeIn(b) for b in bars], lag_ratio=0.12), run_time=1.6)
        self.play(Write(bottoms), run_time=0.5)
        self.play(Write(tops), run_time=0.8)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
