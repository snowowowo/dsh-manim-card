"""线性变换：剪切

@expect 网格被剪切：横行水平错动、竖列倾斜，变换前网格以低透明度 ghost 留在原位对照，
        一个 1×1 参照正方形变成同底同高的平行四边形——「每格面积不变（det=1）」看得见。
@note 讲解模板：剪切矩阵把竖直方向推向水平方向，网格最能看出来；
    ghost（copy 低透明度、不参与 ApplyMatrix）给出「原来是什么」的对照
"""

from manim import *


class ShearTransformScene(Scene):
    def construct(self):
        cells = VGroup()
        for i in range(-3, 3):
            for j in range(-3, 3):
                cell = Square(side_length=0.7, color=BLUE, stroke_width=1.5)
                cell.move_to([i * 0.7 + 0.35, j * 0.7 + 0.35, 0])
                cells.add(cell)

        # 变换前 ghost：低透明度网格留原位，不参与变换
        ghost = cells.copy().set_stroke(GREY, width=1, opacity=0.35)

        # 1×1 参照正方形：剪切后底和高都不变，只是被推歪
        unit = Square(side_length=0.7, color=YELLOW, stroke_width=3).set_fill(YELLOW, 0.35)
        unit.move_to([-0.35 + 0.7, 0.35 + 0.7, 0])

        title = MathTex(r"\begin{bmatrix} 1 & 1 \\ 0 & 1 \end{bmatrix}").move_to([0, 3.4, 0])
        note = Text("每格面积不变：det = 1", font_size=26, color=YELLOW).move_to([0, -2.9, 0])

        self.play(Create(ghost), Create(cells), Write(title))
        self.play(FadeIn(unit), run_time=0.5)
        self.play(ApplyMatrix([[1, 1], [0, 1]], VGroup(cells, unit)), run_time=2)
        self.play(Write(note), run_time=0.5)
        self.wait(0.3)
