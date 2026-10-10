"""商群 G/N：把整个陪集「粘成」一个新元素

@expect 左边 Z/6 按列分成三组，每组就是一个陪集；三组各自收缩成下面一个粗点，得到只有 3 个元素的 G/N。右边新的加法表说明这 3 个新元素自己又构成一个群，结构正是 Z/3。
@note 讲解要点：商群不是「从群里挑出几个元素」，而是把每一整块（陪集）当作一个原子来运算。要做这一步，被商掉的 N 必须是正规子群——交换群里这条自动满足。
"""

from manim import *


class QuotientGroupScene(Scene):
    def construct(self):
        cols = [-6.0, -4.2, -2.4]
        rows = [1.9, 1.0]
        values = [[0, 1, 2], [3, 4, 5]]

        dots = VGroup()
        nums = VGroup()
        for r, y in enumerate(rows):
            for c, x in enumerate(cols):
                dots.add(Dot([x, y, 0], radius=0.13, color=WHITE))
                nums.add(Text(str(values[r][c]), font_size=24, color=YELLOW).move_to([x - 0.42, y, 0]))

        # 包框用原始坐标手算：把已有物体再装进 VGroup 会把它们从原组偷走、丢掉填充
        column_boxes = VGroup(
            *[Rectangle(width=0.66, height=1.4, color=GREEN).move_to([x, 1.45, 0]) for x in cols]
        )

        arrows = VGroup(
            *[Arrow([x, 0.55, 0], [x, -0.35, 0], color=GRAY_A, buff=0, stroke_width=2.5) for x in cols]
        )

        quotient_dots = VGroup()
        quotient_labels = VGroup()
        for idx, x in enumerate(cols):
            big = Circle(radius=0.28, color=BLUE)
            big.set_fill(BLUE, opacity=0.8)
            big.move_to([x, -1.0, 0])
            quotient_dots.add(big)
            quotient_labels.add(
                Text(f"[{idx}]", font_size=24, color=BLUE).move_to([x, -1.8, 0])
            )

        left_head = Text("G = Z/6，N = {0,3}", font_size=26, color=YELLOW).move_to([-4.2, 3.0, 0])
        collapse_note = Text("每个陪集收缩成一个元素", font_size=24, color=GRAY_A).move_to([-4.2, -2.6, 0])

        table_cell = 0.78
        table_center = [3.7, 0.0]
        table_origin_x = table_center[0] - table_cell * 2
        table_origin_y = table_center[1] + table_cell * 2
        table_cells = VGroup()
        table_nums = VGroup()
        for i in range(4):
            for j in range(4):
                cx = table_origin_x + table_cell * (j + 0.5)
                cy = table_origin_y - table_cell * (i + 0.5)
                box = Square(side_length=table_cell, color=GRAY_B, stroke_width=1.5).move_to([cx, cy, 0])
                table_cells.add(box)
                if i == 0 and j == 0:
                    continue
                if i == 0:
                    table_nums.add(Text(f"[{j - 1}]", font_size=20, color=YELLOW).move_to([cx, cy, 0]))
                elif j == 0:
                    table_nums.add(Text(f"[{i - 1}]", font_size=20, color=YELLOW).move_to([cx, cy, 0]))
                else:
                    table_nums.add(
                        Text(f"[{(i - 1 + j - 1) % 3}]", font_size=20, color=WHITE).move_to([cx, cy, 0])
                    )

        right_head = Text("商群 G/N 的加法表", font_size=26, color=BLUE).move_to([3.7, 2.5, 0])
        result = MathTex(r"G/N \cong Z/3", font_size=46).move_to([3.7, -2.6, 0])

        self.play(Write(left_head), run_time=0.6)
        self.play(FadeIn(dots), Write(nums), run_time=0.8)
        self.play(Create(column_boxes), run_time=0.8)
        self.play(LaggedStart(*[Create(a) for a in arrows], lag_ratio=0.2), run_time=0.9)
        self.play(FadeIn(quotient_dots), Write(quotient_labels), run_time=0.8)
        self.play(Write(collapse_note), run_time=0.6)
        self.play(Create(table_cells), Write(right_head), run_time=0.8)
        self.play(LaggedStart(*[FadeIn(t) for t in table_nums], lag_ratio=0.04), run_time=1.4)
        self.play(Write(result), run_time=0.8)
        self.wait(0.4)
