"""关系矩阵：把「自反」和「对称」读成矩阵的样子

@expect 4×4 的方格对应 {1,2,3,4} 上的有序对，填实代表「有这条关系」。绿色小框圈出主对角线（自反），黄色小框圈出一对关于对角线镜像的格子（对称）——图案翻过去完全不变。
@note 讲解要点：关系就是有序对集合，也就是 0/1 矩阵，也就是有向图——同一件事的三种画法。自反 = 主对角线全 1；对称 = 关于主对角线镜像相同；传递 = R∘R ⊆ R，即「沿箭头走两步也仍是箭头」。
"""

from manim import *


class RelationMatrixScene(Scene):
    def construct(self):
        n = 4
        cell = 0.86
        span = n * cell
        origin = [-3.3, -0.2, 0]

        members = [(i, j) for i in range(1, n + 1) for j in range(1, n + 1) if (i - j) % 2 == 0]

        boxes = {}
        centers = {}
        for i in range(1, n + 1):
            for j in range(1, n + 1):
                cx = origin[0] - span / 2 + cell * (j - 0.5)
                cy = origin[1] + span / 2 - cell * (i - 0.5)
                box = Square(side_length=cell, color=GRAY_B, stroke_width=1.5).move_to([cx, cy, 0])
                if (i, j) in members:
                    box.set_fill(BLUE, opacity=0.75)
                boxes[(i, j)] = box
                centers[(i, j)] = (cx, cy)

        # 逐个 add 进唯一的组；不要把已有物体再装进第二个 VGroup
        cells = VGroup()
        for key in sorted(boxes):
            cells.add(boxes[key])

        heads = VGroup()
        for j in range(1, n + 1):
            heads.add(
                Text(str(j), font_size=22, color=YELLOW).move_to(
                    [origin[0] - span / 2 + cell * (j - 0.5), origin[1] + span / 2 + 0.35, 0]
                )
            )
        for i in range(1, n + 1):
            heads.add(
                Text(str(i), font_size=22, color=YELLOW).move_to(
                    [origin[0] - span / 2 - 0.35, origin[1] + span / 2 - cell * (i - 0.5), 0]
                )
            )

        # 高亮框用原始坐标手算：Indicate 会把已填充物体的填充剥掉，不能用在这里
        diag_marks = VGroup(
            *[
                Rectangle(width=cell * 0.9, height=cell * 0.9, color=GREEN, stroke_width=3.5).move_to(
                    [centers[(i, i)][0], centers[(i, i)][1], 0]
                )
                for i in range(1, n + 1)
            ]
        )
        mirror_marks = VGroup(
            *[
                Rectangle(width=cell * 0.9, height=cell * 0.9, color=YELLOW, stroke_width=3.5).move_to(
                    [centers[key][0], centers[key][1], 0]
                )
                for key in [(1, 3), (3, 1)]
            ]
        )

        right_x = 2.7
        r1 = Text("自反：主对角线全为 1", font_size=25, color=GREEN).move_to([right_x, 1.5, 0])
        r2 = Text("对称：关于对角线镜像相同", font_size=25, color=YELLOW).move_to([right_x, 0.7, 0])
        # 「传递」两个字必须走 Text（MathTex 里写中文 = 什么都不显示），公式部分单独一块
        r3_label = Text("传递：", font_size=25).move_to([right_x - 1.5, -0.2, 0])
        r3_math = MathTex(r"R \circ R \subseteq R", font_size=38).move_to([right_x + 0.75, -0.2, 0])
        r4 = Text("i ≡ j (mod 2) 的同余关系", font_size=24, color=BLUE).move_to([right_x, -1.2, 0])
        r5 = Text("三条性质全中 → 等价关系", font_size=25, color=GREEN).move_to([right_x, -2.0, 0])

        caption = Text("关系 = 有序对集合 = 0/1 矩阵 = 有向图，同一件事的三种画法", font_size=24, color=GRAY_A)
        caption.move_to([0, 3.25, 0])

        self.play(Write(caption), run_time=0.7)
        self.play(Create(cells), Write(heads), run_time=1.0)
        self.play(Create(diag_marks), Write(r1), run_time=1.0)
        self.play(Create(mirror_marks), Write(r2), run_time=1.0)
        self.play(Write(r3_label), Write(r3_math), run_time=0.7)
        self.play(Write(r4), Write(r5), run_time=0.8)
        self.wait(0.4)
