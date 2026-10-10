"""拉格朗日中值定理：割线与切线平行

@expect 两端连线（割线，蓝）与中间某点处的切线（黄）**平行**，切点恰好落在中点 x=1。
@note 讲解要点：平均变化率 = 某点瞬时变化率。对 f=x² 在 [0,2] 上，割线斜率 2 就是 x=1 处的导数——
    这就是「存在一点，其瞬时速度等于平均速度」的几何形状。
    两条公式各自 move_to 定位（不叠成 VGroup 再 arrange，见技能里那条「纯 MathTex 组别做几何查询」）。
"""

from manim import *


class MeanValueTheoremScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[0, 2.4, 0.5],
            y_range=[0, 5, 1],
            x_length=5.2,
            y_length=4.0,
            tips=False,
            axis_config={"color": GRAY_B},
        ).shift(LEFT * 2.4 + DOWN * 0.3)

        graph = ax.plot(lambda x: x ** 2, x_range=[0, 2.2], color=WHITE)
        point_a = Dot(ax.c2p(0, 0), color=GREEN)
        point_b = Dot(ax.c2p(2, 4), color=GREEN)
        chord = Line(ax.c2p(0, 0), ax.c2p(2, 4), color=BLUE)
        # 斜率 2 且过 (1,1) 的切线：y = 2x - 1，取 x∈[0.5, 1.9] 保证在框内
        tangent = Line(ax.c2p(0.5, 0), ax.c2p(1.9, 2.8), color=YELLOW)
        point_c = Dot(ax.c2p(1, 1), color=YELLOW)

        chord_slope = MathTex(r"\frac{f(b)-f(a)}{b-a} = 2", color=BLUE, font_size=38).move_to([4.3, 1.1, 0])
        derivative = MathTex(r"f'(c)=2c=2", color=YELLOW, font_size=38).move_to([4.3, 0.2, 0])
        answer = MathTex(r"c = 1", color=YELLOW, font_size=38).move_to([4.3, -0.7, 0])

        self.play(Create(ax), run_time=0.8)
        self.play(Create(graph), run_time=1.0)
        self.play(FadeIn(point_a), FadeIn(point_b), Create(chord), run_time=0.8)
        self.play(Write(chord_slope), run_time=0.6)
        self.play(Create(tangent), FadeIn(point_c), run_time=0.8)
        self.play(Write(derivative), run_time=0.5)
        self.play(Write(answer), run_time=0.5)
        self.play(Indicate(chord, color=BLUE), run_time=0.6)
        self.wait(0.4)
