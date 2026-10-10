"""二重积分：把区域切成小方块

@expect 矩形区域内铺满小方格，落在圆内的格子被高亮，边上的格子只算一部分。
@note 讲解要点：二重积分就是「把区域切成很多小块、每块按 f 加权求和」的极限；格子越细越准。
    高亮用的是「格心在圆内」这一判据——这正是数值积分里最常用的采样方式。
"""

from manim import *
import numpy as np


class DoubleIntegralGridScene(Scene):
    def construct(self):
        dx, dy = 0.5, 0.5
        xs = np.arange(-2.0, 2.0, dx)
        ys = np.arange(-1.5, 1.5, dy)

        inside = VGroup()
        outside = VGroup()
        for x0 in xs:
            for y0 in ys:
                cell = Rectangle(width=dx, height=dy, stroke_width=1)
                cell.move_to([float(x0) + dx / 2, float(y0) + dy / 2, 0])
                if (float(x0) + dx / 2) ** 2 + (float(y0) + dy / 2) ** 2 <= 4.0:
                    cell.set_fill(YELLOW, 0.45)
                    inside.add(cell)
                else:
                    outside.add(cell)

        circle = Circle(radius=2.0, color=RED, stroke_width=3)
        labels = VGroup(
            MathTex(r"\iint_D f(x,y)\,dx\,dy \approx \sum f(x_i,y_j)\,\Delta x\,\Delta y", font_size=38).to_edge(UP),
            MathTex(r"\Delta x = \Delta y = 0.5", color=YELLOW, font_size=32).to_edge(DOWN, buff=0.6),
        )

        self.play(Write(labels[0]), run_time=0.8)
        self.play(Create(outside), Create(circle), run_time=1.0)
        self.play(LaggedStart(*[FadeIn(cell) for cell in inside], lag_ratio=0.02), run_time=1.6)
        self.play(Write(labels[1]), run_time=0.5)
        self.wait(0.4)
