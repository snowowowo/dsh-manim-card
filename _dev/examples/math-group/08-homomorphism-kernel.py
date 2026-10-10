"""同态：核有多大，像就有多小

@expect 左列 Z/6 的六个元素各引出一条箭头指向右列 Z/3 的像；0 和 3 两条红色箭头撞到同一个点 0 上——这两个元素构成核，正好是 2 个；右列三个点全被覆盖，像是 3 个。
@note 讲解要点：同态不是随便的映射，它要保住运算结构。一旦「保住结构」，被压扁成单位元的那部分（核）就一定是一个子群，而且每个像的原像数量完全相同——所以 |G| = |ker φ| × |Im φ|，6 = 2 × 3。
"""

from manim import *


class HomomorphismKernelScene(Scene):
    def construct(self):
        left_x = -3.6
        right_x = 3.6
        left_ys = [2.3 - i * 0.92 for i in range(6)]
        right_ys = [1.15, 0.0, -1.15]

        left_dots = VGroup()
        left_nums = VGroup()
        for i, y in enumerate(left_ys):
            left_dots.add(Dot([left_x, y, 0], radius=0.13, color=WHITE))
            left_nums.add(Text(str(i), font_size=26, color=YELLOW).move_to([left_x - 0.55, y, 0]))

        right_dots = VGroup()
        right_nums = VGroup()
        for j, y in enumerate(right_ys):
            right_dots.add(Dot([right_x, y, 0], radius=0.13, color=WHITE))
            right_nums.add(Text(str(j), font_size=26, color=GREEN).move_to([right_x + 0.55, y, 0]))

        kernel_branches = VGroup()
        image_branches = VGroup()
        for i, y in enumerate(left_ys):
            target = right_ys[i % 3]
            arrow = Arrow([left_x + 0.2, y, 0], [right_x - 0.2, target, 0], buff=0, stroke_width=2.4)
            if i % 3 == 0:
                arrow.set_color(RED)
                kernel_branches.add(arrow)
            else:
                arrow.set_color(GRAY_B)
                image_branches.add(arrow)

        # SurroundingRectangle / VGroup(*) 会「吃掉」被量的那组——量副本
        kernel_box = SurroundingRectangle(VGroup(left_dots[0], left_dots[3]).copy())
        kernel_box.set_color(RED)
        kernel_box.set_stroke(width=3)
        kernel_label = Text("ker φ = {0, 3}，2 个", font_size=25, color=RED).move_to([-5.6, -1.6, 0])

        image_box = SurroundingRectangle(right_dots.copy())
        image_box.set_color(GREEN)
        image_box.set_stroke(width=3)
        image_label = Text("Im φ = Z/3，3 个", font_size=25, color=GREEN).move_to([5.7, 1.9, 0])

        heads = VGroup(
            Text("G = Z/6", font_size=27, color=YELLOW).move_to([left_x, 3.2, 0]),
            Text("G' = Z/3", font_size=27, color=GREEN).move_to([right_x, 3.2, 0]),
        )
        phi = MathTex(r"\varphi(k) = k \bmod 3", font_size=40).move_to([0, 3.2, 0])

        formula = MathTex(r"|G| = |\ker \varphi| \times |\mathrm{Im}\, \varphi| \qquad 6 = 2 \times 3", font_size=40)
        formula.move_to([0, -3.0, 0])

        self.play(Write(heads), Write(phi), run_time=0.8)
        self.play(FadeIn(left_dots), Write(left_nums), FadeIn(right_dots), Write(right_nums), run_time=1.0)
        self.play(LaggedStart(*[Create(a) for a in image_branches], lag_ratio=0.1), run_time=1.2)
        self.play(LaggedStart(*[Create(a) for a in kernel_branches], lag_ratio=0.2), run_time=0.8)
        self.play(Create(kernel_box), Write(kernel_label), run_time=0.8)
        self.play(Create(image_box), Write(image_label), run_time=0.8)
        self.play(Write(formula), run_time=0.8)
        self.wait(0.4)
