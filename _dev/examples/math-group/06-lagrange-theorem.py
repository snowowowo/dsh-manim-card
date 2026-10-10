"""拉格朗日定理：子群把群等分成若干块，块数 × 块大小 = 群大小

@expect 12 个元素排成一行，按所属陪集染成绿 / 黄 / 蓝三种颜色——同色恰好 4 个、三种颜色共 12 个且互不重叠；配色在行内是交错的（0 绿 1 黄 2 蓝 3 绿…），说明陪集互相穿插却从不共用元素。
@note 讲解要点：陪集 aH 就是「把 H 整体平移 a」。平移是双射，所以每块和 H 一样大；互不相交又恰好铺满 G，于是 |G| = 块数 × |H|（拉格朗日定理），子群阶必然整除群阶。
"""

from manim import *


class LagrangeTheoremScene(Scene):
    def construct(self):
        n = 12
        gap = 0.78
        xs = [-4.3 + i * gap for i in range(n)]
        y = 0.5
        coset_colors = [GREEN, YELLOW, BLUE]

        dots = VGroup()
        # 点要按陪集改色：放进普通 Python 列表再按下标取（VGroup 的非字面量下标取不到子物体）
        dot_list = []
        numbers = VGroup()
        for i in range(n):
            dot = Dot([xs[i], y, 0], radius=0.14, color=WHITE)
            dots.add(dot)
            dot_list.append(dot)
            numbers.add(Text(str(i), font_size=22, color=GRAY_A).move_to([xs[i], y + 0.42, 0]))

        for i in range(n):
            dot_list[i].set_color(coset_colors[i % 3])

        h_label = Text("H = ⟨3⟩ = {0, 3, 6, 9}", font_size=25, color=GREEN).move_to([-5.3, 2.4, 0])
        group_label = Text("G = Z/12", font_size=25, color=WHITE).move_to([5.3, 2.4, 0])

        legend = VGroup(
            Text("0 + H", font_size=26, color=GREEN).move_to([-3.0, -0.9, 0]),
            Text("1 + H", font_size=26, color=YELLOW).move_to([0.0, -0.9, 0]),
            Text("2 + H", font_size=26, color=BLUE).move_to([3.0, -0.9, 0]),
        )
        legend_note = Text("同色 = 同一陪集（12 个元素被切成 3 块，每块 4 个）", font_size=24, color=GRAY_A)
        legend_note.move_to([0, -1.55, 0])

        formula = MathTex(
            r"|G| = [G : H] \times |H| \qquad 12 = 3 \times 4",
            font_size=46,
        ).move_to([0, -2.55, 0])
        caption = Text("每块都和 H 一样大，三块拼满全群——所以 4 必须整除 12", font_size=25, color=GRAY_A)
        caption.move_to([0, -3.45, 0])

        self.play(FadeIn(dots), Write(numbers), run_time=1.0)
        self.play(Write(group_label), Write(h_label), run_time=0.6)
        self.play(Write(legend), run_time=0.7)
        self.play(Write(legend_note), run_time=0.7)
        self.play(Write(formula), run_time=0.8)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
