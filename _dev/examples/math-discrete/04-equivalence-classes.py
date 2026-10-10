"""等价类：模 3 同余把 0~8 切成三堆

@expect 上方 0~8 九个数字排成一条线；下方被重新排成三行，每行三个数字——同余的那三个凑成一组并被绿框圈住，三组互不重叠、合起来正好是全部九个数。
@note 讲解要点：等价关系会把集合「切」成若干个互不相交的等价类，每个等价类内部的元素彼此等价、跨类元素绝不等价。三堆合起来还是 9 个、两两无交集——这就是「划分」的定义，也是商集 A/R 的由来。
"""

from manim import *


class EquivalenceClassesScene(Scene):
    def construct(self):
        values = list(range(9))
        line_y = 2.0
        line_x = [-5.6 + i * 1.4 for i in range(9)]

        line_dots = VGroup(*[Dot([line_x[i], line_y, 0], radius=0.13, color=WHITE) for i in range(9)])
        line_labels = VGroup(
            *[Text(str(i), font_size=24, color=YELLOW).move_to([line_x[i], line_y + 0.42, 0]) for i in range(9)]
        )

        line_head = Text("全集 A = {0,1,2,…,8}", font_size=25, color=GRAY_A).move_to([0, 3.1, 0])

        colors = [GREEN, YELLOW, BLUE]
        rows_y = [0.5, -0.95, -2.4]
        row_x = [-3.6, -1.2, 1.2]

        groups = VGroup()
        groups_content = VGroup()
        group_labels = VGroup()
        for mod in range(3):
            members = [v for v in values if v % 3 == mod]
            vgroup = VGroup()
            for idx, v in enumerate(members):
                dot = Dot([row_x[idx], rows_y[mod], 0], radius=0.15, color=colors[mod])
                num = Text(str(v), font_size=24, color=colors[mod]).move_to([row_x[idx], rows_y[mod] + 0.42, 0])
                vgroup.add(dot, num)
            # SurroundingRectangle 会「吃掉」被量的那组——量副本；同时 vgroup 本身要上屏
            frame = SurroundingRectangle(vgroup.copy())
            frame.set_color(colors[mod])
            frame.set_stroke(width=3)
            groups.add(frame)
            groups_content.add(vgroup)
            group_labels.add(
                Text(f"[{mod}] = {{{', '.join(str(m) for m in members)}}}", font_size=24, color=colors[mod])
                .move_to([4.3, rows_y[mod], 0])
            )

        caption = Text("三个等价类：两两不交，并起来还是全集", font_size=25, color=GREEN).move_to([0, -3.5, 0])

        self.play(Write(line_head), run_time=0.6)
        self.play(FadeIn(line_dots), Write(line_labels), run_time=0.9)
        self.play(
            LaggedStart(*[FadeIn(g) for g in groups_content], lag_ratio=0.35),
            LaggedStart(*[Create(f) for f in groups], lag_ratio=0.35),
            run_time=1.6,
        )
        self.play(Write(group_labels), run_time=0.8)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
