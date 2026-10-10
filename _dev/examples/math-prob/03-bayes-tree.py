"""贝叶斯公式：一棵树上把先验和似然合成后验

@expect 左侧两层分叉的树把「患病 1% × 检出 99%」和「健康 99% × 误报 5%」两条路分别铺开；右侧列出两条路的联合概率，绿色那条阳性总概率是分母，红色那条占比就是后验。
@note 讲解要点：阳性结果里真患病只占约 1/6——因为健康人基数大，哪怕误报率只有 5%，误报的绝对数量也远大于真阳性。这就是「基率」被忽略的代价。
"""

from manim import *

ROOT = [-5.9, 0, 0]
LV2_SICK = [-3.6, 1.4, 0]
LV2_WELL = [-3.6, -1.4, 0]
LV3_POS_SICK = [-1.4, 2.25, 0]
LV3_NEG_SICK = [-1.4, 0.55, 0]
LV3_POS_WELL = [-1.4, -0.55, 0]
LV3_NEG_WELL = [-1.4, -2.25, 0]


class BayesTreeScene(Scene):
    def construct(self):
        branch = lambda a, b, c=GRAY_B: Line(a, b, color=c, stroke_width=2.5)

        trunk = VGroup(branch(ROOT, LV2_SICK, BLUE), branch(ROOT, LV2_WELL, YELLOW))
        upper = VGroup(branch(LV2_SICK, LV3_POS_SICK, RED), branch(LV2_SICK, LV3_NEG_SICK))
        lower = VGroup(branch(LV2_WELL, LV3_POS_WELL, RED), branch(LV2_WELL, LV3_NEG_WELL))

        root_dot = Dot(ROOT, radius=0.09, color=WHITE)
        level2_dots = VGroup(
            Dot(LV2_SICK, radius=0.09, color=BLUE),
            Dot(LV2_WELL, radius=0.09, color=YELLOW),
        )
        leaves = VGroup(
            Dot(LV3_POS_SICK, radius=0.09, color=RED),
            Dot(LV3_NEG_SICK, radius=0.09, color=GRAY_B),
            Dot(LV3_POS_WELL, radius=0.09, color=RED),
            Dot(LV3_NEG_WELL, radius=0.09, color=GRAY_B),
        )

        head_labels = VGroup(
            Text("全体", font_size=24).move_to([-6.5, 0, 0]),
            Text("患病 1%", font_size=24, color=BLUE).move_to([-4.75, 1.0, 0]),
            Text("健康 99%", font_size=24, color=YELLOW).move_to([-4.75, -1.0, 0]),
        )
        rate_labels = VGroup(
            Text("检出 99%", font_size=22, color=RED).move_to([-2.6, 2.02, 0]),
            Text("漏检 1%", font_size=22, color=GRAY_A).move_to([-2.6, 0.78, 0]),
            Text("误报 5%", font_size=22, color=RED).move_to([-2.6, -0.78, 0]),
            Text("排除 95%", font_size=22, color=GRAY_A).move_to([-2.6, -2.02, 0]),
        )
        leaf_labels = VGroup(
            Text("阳性", font_size=26, color=RED).move_to([-0.95, 2.25, 0]),
            Text("阴性", font_size=26, color=GRAY_B).move_to([-0.95, 0.55, 0]),
            Text("阳性", font_size=26, color=RED).move_to([-0.95, -0.55, 0]),
            Text("阴性", font_size=26, color=GRAY_B).move_to([-0.95, -2.25, 0]),
        )

        line_sick_pos = Text("P(病 ∩ 阳) = 0.01 × 0.99 = 0.0099", font_size=24, color=BLUE)
        line_sick_pos.move_to([3.6, 2.25, 0])
        line_well_pos = Text("P(健康 ∩ 阳) = 0.99 × 0.05 = 0.0495", font_size=24, color=YELLOW)
        line_well_pos.move_to([3.6, 1.05, 0])
        line_total = Text("P(阳) = 0.0099 + 0.0495 = 0.0594", font_size=24, color=GREEN)
        line_total.move_to([3.6, -0.5, 0])
        posterior = Text("P(病 | 阳) = 0.0099 / 0.0594 ≈ 0.167", font_size=30, color=RED)
        posterior.move_to([3.6, -1.9, 0])

        caption = Text("阳性里真患病只有约 1/6——基数大的误报盖过了真阳性", font_size=24, color=GRAY_A)
        caption.to_edge(DOWN, buff=0.35)

        self.play(Create(trunk), FadeIn(root_dot), run_time=0.8)
        self.play(Write(head_labels), FadeIn(level2_dots), run_time=0.8)
        self.play(Create(upper), Create(lower), FadeIn(leaves), run_time=1.0)
        self.play(Write(rate_labels), run_time=0.9)
        self.play(Write(leaf_labels), run_time=0.8)
        self.play(Write(line_sick_pos), Write(line_well_pos), run_time=0.9)
        self.play(Write(line_total), run_time=0.7)
        self.play(Write(posterior), run_time=0.9)
        self.play(Write(caption), run_time=0.8)
        self.wait(0.4)
