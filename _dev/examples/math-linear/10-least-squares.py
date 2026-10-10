"""最小二乘：拟合直线与残差

@expect 五个数据点上方有一条蓝色拟合直线，每个点到直线的竖直残差用灰色虚线画出、长短一目了然。
@note 讲解要点：数据不可能刚好排在一条线上，所以「解不存在」；退一步求**让残差平方和最小**的那条线。
    残差竖线与直线垂直（图的纵横比一致），所以这套图里直角是看得出来的。
"""

from manim import *


class LeastSquaresScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[0, 3.2, 1],
            y_range=[0, 4.2, 1],
            x_length=6.6,
            y_length=4.2,
            tips=False,
            axis_config={"color": GRAY_B},
        ).shift(LEFT * 1.2 + DOWN * 0.2)

        xs = [0.5, 1.0, 1.6, 2.2, 2.8]
        ys = [1.1, 2.2, 2.0, 3.3, 3.1]
        points = VGroup(*[Dot(ax.c2p(x, y), radius=0.07, color=YELLOW) for x, y in zip(xs, ys)])

        fit = ax.plot(lambda x: 0.9 * x + 0.75, x_range=[0.2, 3.0], color=BLUE)
        residuals = VGroup(*[
            DashedLine(ax.c2p(x, y), ax.c2p(x, 0.9 * x + 0.75), color=GRAY_B, stroke_width=2)
            for x, y in zip(xs, ys)
        ])

        title = MathTex(r"\min_{a,b}\sum_i\bigl(y_i - (ax_i+b)\bigr)^2", font_size=40).to_edge(UP)
        fit_label = MathTex(r"y = 0.9x + 0.75", color=BLUE, font_size=34).move_to([4.6, 1.0, 0])
        note = Text("残差竖直方向量", font_size=26, color=GRAY_A).move_to([4.6, 0.1, 0])

        self.play(Create(ax), Write(title), run_time=1.0)
        self.play(LaggedStart(*[FadeIn(dot) for dot in points], lag_ratio=0.15), run_time=1.0)
        self.play(Create(fit), Write(fit_label), run_time=0.9)
        self.play(LaggedStart(*[Create(line) for line in residuals], lag_ratio=0.12), run_time=1.0)
        self.play(Write(note), run_time=0.5)
        self.wait(0.4)
