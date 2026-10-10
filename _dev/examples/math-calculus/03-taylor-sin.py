"""泰勒展开：多项式逐阶逼近 sin x

@expect 1 次、3 次、5 次、7 次多项式一条比一条贴近正弦曲线，在原点附近先贴合、越远越偏；
        右边那条公式逐阶补全为完整多项式（1 阶到 7 阶一项不缺），最终颜色与 7 阶曲线一致。
@note 讲解要点：阶数越高「贴合区间」越宽，但**每一阶都是往同一个点（原点）对齐**——远处永远靠不住。
    这是「局部逼近」最直观的画面：别指望用多项式在大范围上代替 sin。
"""

from manim import *
import math
import numpy as np


class TaylorSinScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[-PI, PI, PI / 2],
            y_range=[-1.8, 1.8, 1],
            x_length=7.2,
            y_length=3.6,
            tips=False,
            axis_config={"color": GRAY_B},
        ).shift(LEFT * 1.4)

        def taylor(terms):
            # sin x 的泰勒部分和：terms=1/2/3/4 分别是 1、3、5、7 阶
            def f(x):
                total = 0.0
                for k in range(terms):
                    total += (-1) ** k * x ** (2 * k + 1) / math.factorial(2 * k + 1)
                return total
            return f

        sine = ax.plot(lambda x: np.sin(x), x_range=[-PI, PI], color=RED, stroke_width=5)
        colors = [BLUE, TEAL, GREEN, YELLOW]
        # 每一阶新加的那一项；最终公式由这些项拼成完整的多项式
        parts = [r"x", r"-\frac{x^3}{3!}", r"+\frac{x^5}{5!}", r"+\frac{x^7}{7!}"]

        def make_formula(n_terms):
            tex = MathTex("".join(parts[:n_terms]), font_size=46)
            tex.set_color(colors[n_terms - 1])
            tex.move_to([4.6, 0, 0])
            return tex

        title = MathTex(r"\sin x \approx \sum_{k=0}^{n}\frac{(-1)^k x^{2k+1}}{(2k+1)!}", font_size=38).to_edge(UP)

        self.play(Create(ax), Write(title), run_time=1.0)
        self.play(Create(sine), run_time=1.0)
        formula = make_formula(1)
        first = ax.plot(taylor(1), x_range=[-PI, PI], color=colors[0])
        self.play(Create(first), Write(formula), run_time=0.9)
        for index in range(1, 4):
            curve = ax.plot(taylor(index + 1), x_range=[-PI, PI], color=colors[index])
            self.play(Create(curve), FadeOut(formula), run_time=0.7)
            formula = make_formula(index + 1)
            self.play(Write(formula), run_time=0.5)
        self.wait(0.4)
