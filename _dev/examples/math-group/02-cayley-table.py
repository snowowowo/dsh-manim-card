"""Cayley 表：一张表就把群的三条公理读出来

@expect 4×4 的加法表填满 (Z/4, +)：第一行（单位元 e=0 那一行）与表头完全一致，主对角线附近成对出现的 1↔3、2↔2 互为逆元——表里没有空格，说明运算封闭。
@note 讲解要点：Cayley 表是群的「乘法口诀」。只要表是封闭的、每行每列都是表头的一个排列、且有一行与表头相同，这个集合就自动满足群的四条公理。
"""

from manim import *


class CayleyTableScene(Scene):
    def construct(self):
        n = 4
        cell = 0.85
        total = (n + 1) * cell
        center = [0, -0.3, 0]
        top = center[1] + total / 2
        left = center[0] - total / 2

        def pos(row, col):
            return [left + cell * (col + 0.5), top - cell * (row + 0.5), 0]

        cells = VGroup()
        nums = VGroup()
        for row in range(n + 1):
            for col in range(n + 1):
                box = Square(side_length=cell, color=GRAY_B, stroke_width=1.5)
                box.move_to(pos(row, col))
                cells.add(box)

        headers = VGroup()
        for col in range(n):
            headers.add(Text(str(col), font_size=28, color=YELLOW).move_to(pos(0, col + 1)))
            headers.add(Text(str(col), font_size=28, color=YELLOW).move_to(pos(col + 1, 0)))

        identity_row = VGroup()
        for col in range(n):
            value = col
            num = Text(str(value), font_size=28, color=GREEN).move_to(pos(1, col + 1))
            identity_row.add(num)
            nums.add(num)
        # (1,3) 与 (3,1) 互为逆元：直接把这两格的数字染红，不要再叠一层字
        inverse_keys = [(1, 3), (3, 1)]
        for row in range(1, n):
            for col in range(n):
                value = (row + col) % n
                if (row, col) in inverse_keys:
                    color = RED
                elif value == 0:
                    color = WHITE
                else:
                    color = GRAY_A
                nums.add(Text(str(value), font_size=28, color=color).move_to(pos(row + 1, col + 1)))

        inverse_sym = Text("1 + 3 = 3 + 1 = 0，互为逆元；2 + 2 = 0，2 自己是自己的逆", font_size=24, color=RED)
        inverse_sym.move_to([0, -3.4, 0])

        corner = Text("+", font_size=30, color=GRAY_A).move_to(pos(0, 0))

        formula = MathTex(r"(G, +) = (Z/4, +)", font_size=44).to_edge(UP, buff=0.3)
        caption = Text("第一行 = 表头（e 行），每条对角线都成逆元对，表里无空格 = 封闭", font_size=24, color=GRAY_A)
        caption.move_to([0, 2.35, 0])

        self.play(Write(formula), run_time=0.7)
        self.play(Create(cells), Write(headers), Write(corner), run_time=1.0)
        self.play(LaggedStart(*[FadeIn(x) for x in nums], lag_ratio=0.03), run_time=1.6)
        self.play(Indicate(identity_row, color=GREEN, scale_factor=1.06), run_time=0.8)
        self.play(Write(inverse_sym), run_time=0.7)
        self.play(Write(caption), run_time=0.8)
        self.wait(0.4)
