"""变上限积分：面积函数 S(x) 与它的导数

@expect 曲线下的面积一块块往右长出来，右侧数字 S(x) 同步变大；最后点明 S'(x)=f(x)。
@note 讲解要点：变上限积分是「一边走一边累加面积」，所以它的变化率就是被积函数本身——
    微积分基本定理的直观形状。这里用四个固定 x 逐块出现，不做连续滑动（画面上更容易看清每块的边界）。
"""

from manim import *


class AccumulationFunctionScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[0, 2.6, 0.5],
            y_range=[0, 3.2, 1],
            x_length=6.0,
            y_length=3.4,
            tips=False,
            axis_config={"color": GRAY_B},
        )
        ax.shift(LEFT * 1.6 + DOWN * 0.4)
        graph = ax.plot(lambda x: 0.5 * x * x + 0.4, x_range=[0, 2.4], color=WHITE)

        areas = VGroup(*[
            ax.get_area(graph, x_range=[0, x_stop], color=BLUE, opacity=0.35)
            for x_stop in [0.6, 1.2, 1.8, 2.4]
        ])
        markers = VGroup(*[
            Dot(ax.c2p(x_stop, 0.5 * x_stop ** 2 + 0.4), radius=0.05, color=YELLOW)
            for x_stop in [0.6, 1.2, 1.8, 2.4]
        ])
        values = VGroup(*[
            DecimalNumber(
                0.5 * x_stop ** 3 / 3 + 0.4 * x_stop, num_decimal_places=2, font_size=30,
            ).move_to([3.5, 1.2 - index * 0.62, 0])
            for index, x_stop in enumerate([0.6, 1.2, 1.8, 2.4])
        ])
        caption = MathTex(r"S(x)=\int_0^x f(t)\,dt,\quad S'(x)=f(x)", font_size=40).to_edge(UP)

        self.play(Create(ax), Create(graph), Write(caption), run_time=1.0)
        for index in range(4):
            self.play(FadeIn(areas[index]), FadeIn(markers[index]), FadeIn(values[index]), run_time=0.7)
        self.play(Indicate(caption, color=YELLOW), run_time=0.8)
        self.wait(0.4)
