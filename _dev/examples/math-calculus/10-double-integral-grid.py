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
        partial = VGroup()
        outside = VGroup()
        partial_cells = []
        for x0 in xs:
            for y0 in ys:
                cell = Rectangle(width=dx, height=dy, stroke_width=1)
                cell.move_to([float(x0) + dx / 2, float(y0) + dy / 2, 0])
                cx, cy = float(x0) + dx / 2, float(y0) + dy / 2
                r2 = cx ** 2 + cy ** 2
                if r2 <= 4.0:
                    cell.set_fill(YELLOW, 0.45)
                    inside.add(cell)
                else:
                    # 格心在外但方块与圆相交：四角至少一角落圆内，按角点比例估权重
                    corners = [(cx - dx / 2, cy - dy / 2), (cx + dx / 2, cy - dy / 2),
                               (cx - dx / 2, cy + dy / 2), (cx + dx / 2, cy + dy / 2)]
                    frac = sum(1.0 for ux, uy in corners if ux ** 2 + uy ** 2 <= 4.0) / 4.0
                    if frac > 0:
                        cell.set_fill(YELLOW, 0.15)
                        partial.add(cell)
                        partial_cells.append((cx, cy, frac))
                    else:
                        outside.add(cell)

        circle = Circle(radius=2.0, color=RED, stroke_width=3)
        weight_marks = VGroup()
        for cx, cy, frac in partial_cells[:3]:
            mark = Text(f"{frac:.2f}", font_size=16, color=WHITE)
            mark.move_to([cx, cy, 0])
            weight_marks.add(mark)
        labels = VGroup(
            MathTex(r"\iint_D f(x,y)\,dx\,dy \approx \sum f(x_i,y_j)\,\Delta x\,\Delta y", font_size=38).to_edge(UP),
            MathTex(r"\Delta x = \Delta y = 0.5", color=YELLOW, font_size=32).to_edge(DOWN, buff=0.6),
        )

        self.play(Write(labels[0]), run_time=0.8)
        self.play(Create(outside), Create(circle), run_time=1.0)
        self.play(LaggedStart(*[FadeIn(cell) for cell in inside], lag_ratio=0.02), run_time=1.6)
        self.play(FadeIn(partial), Write(weight_marks), run_time=0.8)
        self.play(Write(labels[1]), run_time=0.5)
        self.wait(0.4)
