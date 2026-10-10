"""上积分与下积分：同一段区间两种取点法夹住真值

@expect 左端点（低）与右端点（高）两组矩形画在同一条分割上：黄色实心块始终在曲线内，蓝色描边框的顶边始终高出曲线；
        两组各带文字标注（上和 / 下和），对比一眼可见。
@note 讲解要点：两者都随 dx 变小而互相靠近，共同的极限就是定积分——「上和 ≥ 积分 ≥ 下和」。
    两条说明各自定位（纯 MathTex 组上做几何查询在我们没 KaTeX 的离线套件里会假报错）。
"""

from manim import *


class UpperLowerSumScene(Scene):
    def construct(self):
        ax = Axes(
            x_range=[0, 2.6, 0.5],
            y_range=[0, 3.2, 1],
            x_length=5.6,
            y_length=3.6,
            tips=False,
            axis_config={"color": GRAY_B},
        ).shift(LEFT * 1.8 + DOWN * 0.35)
        graph = ax.plot(lambda x: 0.5 * x * x + 0.4, x_range=[0, 2.4], color=WHITE)

        # 手工算坐标画矩形（与 Axes 的映射保持同一套常数），绕开几何查询
        # Axes 的 (0,0) 在其包围盒左下角：x 轴长 5.6、y 轴长 3.6，整体中心在 (-1.8, -0.35)
        x_unit = 5.6 / 2.6
        y_unit = 3.6 / 3.2
        origin = [-1.8 - x_unit * 1.3, -0.35 - y_unit * 1.6, 0]
        f = lambda x: 0.5 * x * x + 0.4

        def bar(x0, x1, h, color, fill_opacity):
            rect = Rectangle(width=(x1 - x0) * x_unit, height=h * y_unit, color=color, stroke_width=2)
            rect.set_fill(color, opacity=fill_opacity)
            rect.move_to([origin[0] + (x0 + x1) / 2 * x_unit, origin[1] + h * y_unit / 2, 0])
            return rect

        edges = [0.0, 0.5, 1.0, 1.5, 2.0]
        upper = VGroup(*[bar(edges[i], edges[i + 1], f(edges[i + 1]), BLUE, 0.0) for i in range(4)])
        lower = VGroup(*[bar(edges[i], edges[i + 1], f(edges[i]), YELLOW, 0.75) for i in range(4)])

        label_upper = Text("上和（右端点）", font_size=24, color=BLUE).move_to([1.2, 0.25, 0])
        label_lower = Text("下和（左端点）", font_size=24, color=YELLOW).move_to([1.2, -1.0, 0])
        high_label = MathTex(r"S_{\text{right}}", color=BLUE, font_size=40).move_to([4.6, 1.35, 0])
        low_label = MathTex(r"s_{\text{left}}", color=YELLOW, font_size=40).move_to([4.6, 0.0, 0])
        integral = MathTex(r"\int_0^2 f", font_size=44).move_to([5.6, 0.7, 0])
        caption = Text("上和 ≥ 积分 ≥ 下和", font_size=28).to_edge(DOWN, buff=0.4)

        self.play(Create(ax), Create(graph), run_time=1.0)
        self.play(FadeIn(lower), Write(label_lower), Write(low_label), run_time=0.8)
        self.play(Create(upper), Write(label_upper), Write(high_label), Write(integral), run_time=0.8)
        self.play(Write(caption), run_time=0.6)
        self.wait(0.4)
