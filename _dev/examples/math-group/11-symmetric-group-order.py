"""对称群的阶按 n! 爆炸

@expect 六根柱子的高度只按 log10(n!) 等比缩放，所以画面上「看起来」只是平缓上升；但每根柱子顶端标的真实数值从 2 一路跳到 5040，涨幅完全不成比例。
@note 讲解要点：|S_n| = n! 是指数级的爆炸——用对数轴才画得下。这解释了为什么 n 稍大一点，「把 n 个东西全排一遍」这种穷举做法就彻底不可行，也解释了群论里「找生成元」为什么远比「列表」重要。
"""

from manim import *
import math


class SymmetricGroupOrderScene(Scene):
    def construct(self):
        ns = [2, 3, 4, 5, 6, 7]
        orders = [math.factorial(n) for n in ns]
        logs = [math.log10(o) for o in orders]
        peak = max(logs)

        xs = [-5.0 + i * 2.0 for i in range(len(ns))]
        base_y = -2.6
        max_h = 4.0

        bars = VGroup()
        tops = VGroup()
        bottoms = VGroup()
        stem_labels = VGroup()
        for x, n, order, lg in zip(xs, ns, orders, logs):
            height = lg / peak * max_h
            bar = Rectangle(width=1.1, height=height, color=BLUE)
            bar.set_fill(BLUE, opacity=0.7)
            bar.move_to([x, base_y + height / 2, 0])
            bars.add(bar)
            tops.add(Text(f"{order}", font_size=24, color=YELLOW).move_to([x, base_y + height + 0.35, 0]))
            bottoms.add(Text(f"S{n}", font_size=24, color=GREEN).move_to([x, base_y - 0.42, 0]))
            stem_labels.add(
                Text(f"log10 = {lg:.2f}", font_size=15, color=GRAY_A).move_to([x, base_y + height / 2, 0])
            )

        baseline = Line([-6.2, base_y, 0], [6.2, base_y, 0], color=GRAY_B, stroke_width=2)

        formula = MathTex(r"|S_n| = n!", font_size=52).to_edge(UP, buff=0.35)
        caption = Text("4.5 倍 / 6.5 倍 / 14 倍……每一档都在加速", font_size=24, color=GRAY_A)
        caption.move_to([0, 2.7, 0])
        note = Text("柱子高度是按对数画的；标出来的是真实阶", font_size=24, color=YELLOW)
        note.move_to([0, -3.35, 0])

        self.play(Write(formula), Write(caption), run_time=0.8)
        self.play(Create(baseline), run_time=0.4)
        self.play(LaggedStart(*[FadeIn(b) for b in bars], lag_ratio=0.15), run_time=1.6)
        self.play(Write(bottoms), run_time=0.6)
        self.play(Write(tops), run_time=0.8)
        self.play(FadeIn(stem_labels), run_time=0.6)
        self.play(Write(note), run_time=0.7)
        self.wait(0.4)
