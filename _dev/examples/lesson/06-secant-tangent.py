"""割线趋近切线（导数的定义）

@expect 割线绕切点旋转、越来越贴近切线，最终重合。
@template 要讲「极限 / 趋近」——一条线或一个量随参数滑动、逼近目标位置时照它抄。
@note 2026-10-09 真机事故原文：这段被预检误拒两次——`(pos_p() + pos_m()) / 2` 与
      `x0 + h.get_value()` 都拿 c2p / get_value 的返回值做算术，而预检把它们当成了 Mobject
      （`TypeError: unsupported operand type(s) for /: 'Mobject' and 'int'`）。
      修在支持面的 METHOD_RETURNS：预检按真桥的形状返值（坐标→向量、数值→数）。
"""

from manim import *
import numpy as np


class SecantToTangent(Scene):
    def construct(self):
        ax = Axes(
            x_range=[-0.5, 3, 1],
            y_range=[-0.5, 5, 1],
            x_length=6.0,
            y_length=4.6,
            tips=False,
            axis_config={"color": GRAY_D},
        )
        ax.shift(LEFT * 3.4 + DOWN * 0.4)
        # 轴标签手动定位：get_axis_labels 的自动定位会把 "x" 漂到轴外空白处；
        # 适配层 ax.x_axis 是函数不能 get_end，改用 c2p 手算轴末端坐标
        label_x = Text("x", font_size=30, color=GRAY_D).move_to(ax.c2p(3.15, -0.35))
        label_y = Text("y", font_size=30, color=GRAY_D).move_to(ax.c2p(-0.35, 5.25))

        graph = ax.plot(lambda x: x ** 2, x_range=[0.1, 2.3], color=BLUE)

        x0 = 1.0
        h = ValueTracker(1.0)

        def pos_p():
            return ax.c2p(x0, x0 ** 2, 0)

        def pos_q():
            x = x0 + h.get_value()
            return ax.c2p(x, x ** 2, 0)

        def pos_m():
            x = x0 + h.get_value()
            return ax.c2p(x, x0 ** 2, 0)

        # 割线
        secant = Line(pos_p(), pos_q(), color=YELLOW, stroke_width=3)
        secant.add_updater(lambda m: m.put_start_and_end_on(pos_p(), pos_q()))

        # 两点
        dot_p = Dot(pos_p(), color=WHITE, radius=0.07)
        dot_q = Dot(pos_q(), color=YELLOW, radius=0.07)
        dot_q.add_updater(lambda m: m.move_to(pos_q()))

        # 水平 / 竖直增量
        seg_dx = DashedLine(pos_p(), pos_m(), color=GRAY_B, stroke_width=2)
        seg_dx.add_updater(lambda m: m.put_start_and_end_on(pos_p(), pos_m()))
        seg_dy = DashedLine(pos_m(), pos_q(), color=GRAY_B, stroke_width=2)
        seg_dy.add_updater(lambda m: m.put_start_and_end_on(pos_m(), pos_q()))

        dx_label = MathTex("h", font_size=36, color=GRAY_A)
        dx_label.add_updater(lambda m: m.move_to((pos_p() + pos_m()) / 2 + DOWN * 0.3))
        dy_label = MathTex(r"\Delta y", font_size=36, color=GRAY_A)
        dy_label.add_updater(lambda m: m.move_to((pos_m() + pos_q()) / 2 + RIGHT * 0.42))

        # 差商公式
        eq = MathTex(r"\frac{f(x_0+h)-f(x_0)}{h}", font_size=44)
        eq.move_to([3.6, 1.0, 0])
        result = MathTex(r"f'(x_0)=2x_0", font_size=44)
        result.move_to([3.6, 1.0, 0])
        caption = MathTex(r"h\to 0", font_size=40, color=YELLOW).next_to(eq, DOWN, buff=0.7)

        # 切线
        tangent = DashedLine(
            ax.c2p(0.15, 2 * 0.15 - 1, 0),
            ax.c2p(2.5, 2 * 2.5 - 1, 0),
            color=RED,
            stroke_width=3,
        )

        self.play(Create(ax), Write(label_x), Write(label_y), run_time=1.0)
        self.play(Create(graph), run_time=1.0)
        self.play(FadeIn(dot_p), FadeIn(dot_q), run_time=0.5)
        self.play(Create(secant), run_time=0.7)
        self.play(Create(seg_dx), Create(seg_dy), Write(dx_label), Write(dy_label), run_time=0.8)
        self.play(Write(eq), run_time=0.8)
        self.play(Write(caption), run_time=0.4)

        # h 变小，割线滑向切线
        self.play(h.animate.set_value(0.12), run_time=3.0, rate_func=smooth)
        self.play(FadeIn(tangent), run_time=0.7)
        self.play(FadeTransform(eq, result), run_time=1.0)
        self.play(Indicate(result, color=YELLOW, scale_factor=1.15), run_time=0.8)
        self.wait(0.8)
