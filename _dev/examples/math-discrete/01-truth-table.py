"""真值表：p → q 和 ¬p ∨ q 逐行等价

@expect 五列的表格里，p、q、¬p、p→q、¬p∨q 四行取值全部填满；最后两列被绿框一起圈住——上下四行逐格相同，右侧标出「恒等」。
@note 讲解要点：蕴含 p→q 只在「p 真而 q 假」时为假，这正好等于 ¬p∨q 的真值。逻辑等价的判据不是「意思像」，而是真值表逐行一致——两张表相同，两个公式就可以互相替换。
"""

from manim import *


class TruthTableScene(Scene):
    def construct(self):
        headers = ["p", "q", "¬p", "p → q", "¬p ∨ q"]
        rows = [
            ["真", "真", "假", "真", "真"],
            ["真", "假", "假", "假", "假"],
            ["假", "真", "真", "真", "真"],
            ["假", "假", "真", "真", "真"],
        ]

        ncol = len(headers)
        nrow = len(rows) + 1
        cell = 0.95
        width = ncol * cell
        height = nrow * cell
        center = [0, -0.3, 0]
        left = center[0] - width / 2
        top = center[1] + height / 2

        def pos(row, col):
            return [left + cell * (col + 0.5), top - cell * (row + 0.5), 0]

        cells = VGroup()
        for r in range(nrow):
            for c in range(ncol):
                box = Square(side_length=cell, color=GRAY_B, stroke_width=1.5).move_to(pos(r, c))
                cells.add(box)

        head_texts = VGroup(
            *[Text(name, font_size=26, color=YELLOW).move_to(pos(0, c)) for c, name in enumerate(headers)]
        )

        body = VGroup()
        for r, values in enumerate(rows):
            for c, value in enumerate(values):
                color = GRAY_A
                if c == 3 and value == "假":
                    color = RED
                if c == 4 and value == "假":
                    color = RED
                body.add(Text(value, font_size=26, color=color).move_to(pos(r + 1, c)))

        # 高亮框按坐标手算，不圈组：SurroundingRectangle(组) 会让被量的组之后不再渲染，
        # 而且这些格子已经在外面的 cells 组里了——同一个物体进两个组本身就致病
        box = Rectangle(
            width=cell * 2 + 0.16,
            height=height + 0.16,
            color=GREEN,
            stroke_width=3,
        ).move_to([left + cell * 4, center[1], 0])

        equal_note = Text("两列逐行相同 → 逻辑等价", font_size=24, color=GREEN).move_to([0, 2.6, 0])
        # 绿框右缘 x≈2.93，右侧标出「恒等」
        ident_note = Text("恒等", font_size=24, color=GREEN).move_to([3.6, -0.3, 0])
        # 公式用绝对坐标定位（to_edge 要读包围盒，长公式会读出 NaN 而整条消失）
        formula = MathTex(r"p \to q \equiv \neg p \lor q", font_size=44).move_to([0, 3.3, 0])
        caption = Text("「p 真且 q 假」是唯一让蕴含为假的一行——红字就是它", font_size=24, color=GRAY_A)
        caption.move_to([0, -3.35, 0])

        self.play(Write(formula), Write(equal_note), run_time=0.8)
        self.play(Create(cells), Write(head_texts), run_time=0.9)
        self.play(LaggedStart(*[FadeIn(t) for t in body], lag_ratio=0.03), run_time=1.5)
        self.play(Create(box), Write(ident_note), run_time=0.7)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
