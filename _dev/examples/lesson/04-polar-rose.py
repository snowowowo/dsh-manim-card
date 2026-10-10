"""极坐标玫瑰线

@expect 玫瑰线的花瓣数与方程参数一致：左边 k=5 是 5 瓣（k 奇）、右边 k=2 是 4 瓣（2k 瓣，k 偶），
两条曲线各自配方程标注，「奇 k → k 瓣 / 偶 k → 2k 瓣」的规律对照着看得出来。
@template 要画极坐标 / 参数方程曲线（玫瑰线、螺线、摆线……manim-web 没有 plot_polar_graph）时照它抄。
@note 讲解模板：manim-web 没有 plot_polar_graph——把 r(θ) 写成参数方程交给 ParametricFunction；
    MathTex 定位只能 move_to 绝对坐标（to_edge 会拿 NaN 包围盒把公式挪出画框）
"""

from manim import *
import numpy as np


class PolarRoseScene(Scene):
    def construct(self):
        def rose(petals, scale):
            def f(t):
                r = scale * np.cos(petals * t)
                return [r * np.cos(t), r * np.sin(t), 0]
            return f

        # 左：k=5（10 瓣）；右：k=2（4 瓣）——两组并排对照
        curve_5 = ParametricFunction(rose(5, 1.7), t_range=[0, TAU, 0.02], color=BLUE)
        curve_5.move_to([-3.2, -0.4, 0])
        curve_2 = ParametricFunction(rose(2, 1.7), t_range=[0, TAU, 0.02], color=ORANGE)
        curve_2.move_to([3.2, -0.4, 0])

        title_5 = MathTex(r"r = 2\cos 5\theta", font_size=40).move_to([-3.2, 2.2, 0])
        title_2 = MathTex(r"r = 2\cos 2\theta", font_size=40).move_to([3.2, 2.2, 0])
        note_5 = Text("k=5（奇）→ 5 瓣", font_size=26, color=BLUE).move_to([-3.2, -2.9, 0])
        note_2 = Text("k=2（偶）→ 4 瓣", font_size=26, color=ORANGE).move_to([3.2, -2.9, 0])

        self.play(Write(title_5))
        self.play(Create(curve_5), FadeIn(note_5), run_time=2)
        self.play(Write(title_2))
        self.play(Create(curve_2), FadeIn(note_2), run_time=2)
        self.wait(0.3)
