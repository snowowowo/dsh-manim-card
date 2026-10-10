"""由生成元「带出来」的子群，阶永远整除全群

@expect 最上一行 12 个点代表 (Z/12, +) 的全部元素；下面四行分别把 ⟨1⟩ ⟨2⟩ ⟨3⟩ ⟨4⟩ 能到达的点点亮——依次点亮 12、6、4、3 个点，其余保持暗淡。
@note 讲解要点：重复加 g 只能踩到「间距为 gcd(12,g) 的那一组点」，所以 ⟨g⟩ 的大小是 12/gcd(12,g)，而它必然整除 12。这正是拉格朗日定理在循环群上的具体样子。
"""

from manim import *
import math


class GeneratorSubgroupsScene(Scene):
    def construct(self):
        n = 12
        gap = 0.8
        xs = [-4.4 + i * gap for i in range(n)]

        def make_row(y, gen):
            hit = {0}
            cur = 0
            while True:
                cur = (cur + gen) % n
                if cur in hit:
                    break
                hit.add(cur)
            reached = VGroup()
            unreached = VGroup()
            for i in range(n):
                dot = Dot([xs[i], y, 0], radius=0.11)
                if i in hit:
                    dot.set_color(YELLOW)
                    reached.add(dot)
                else:
                    dot.set_color(GRAY_D)
                    unreached.add(dot)
            return unreached, reached, len(hit)

        top_unreached, top_reached, _ = make_row(2.15, 1)
        tick_labels = VGroup(
            *[Text(str(i), font_size=20, color=GRAY_A).move_to([xs[i], 2.62, 0]) for i in range(n)]
        )

        rows = VGroup()
        labels = VGroup()
        for y, gen in [(1.45, 1), (0.75, 2), (0.05, 3), (-0.65, 4)]:
            unreached, reached, size = make_row(y, gen)
            rows.add(VGroup(unreached, reached))
            labels.add(Text(f"⟨{gen}⟩ → {size} 个", font_size=23, color=YELLOW).move_to([5.85, y, 0]))

        group_label = Text("G = Z/12：12 个元素", font_size=25, color=WHITE).move_to([0, 3.05, 0])
        formula = MathTex(r"|\langle g\rangle| = \frac{12}{\gcd(12,\, g)}", font_size=48)
        formula.move_to([0, -1.75, 0])
        caption = Text("12 / 6 / 4 / 3 —— 全都整除 12，一个例外都没有", font_size=25, color=GREEN)
        caption.move_to([0, -2.75, 0])

        self.play(Write(group_label), run_time=0.6)
        self.play(FadeIn(top_unreached), FadeIn(top_reached), Write(tick_labels), run_time=1.0)
        self.play(LaggedStart(*[FadeIn(r) for r in rows], lag_ratio=0.3), run_time=1.8)
        self.play(Write(labels), run_time=0.9)
        self.play(Write(formula), run_time=0.8)
        self.play(Write(caption), run_time=0.7)
        self.wait(0.4)
