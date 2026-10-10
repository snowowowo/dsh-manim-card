"""Indicate / Flash / Circumscribe

@expect Indicate 是原地缩放闪一下、Flash 是某点迸一下光、Circumscribe 是绕物体画个圈，
        三者形态不同。三段高亮都是过程性的——真时序观察；终帧以名字标注区分三者，
        并给 Circumscribe 留一圈（动画后显式 add 手算 Rectangle）作证。
"""

from manim import *


class IndicateFamilyScene(Scene):
    def construct(self):
        circle = Circle(radius=1.5, color=BLUE)
        circle.move_to([-3.5, 0.3, 0])
        dot = Dot(color=RED)
        dot.move_to([0, 0.3, 0])
        square = Square(side_length=1.5, color=YELLOW)
        square.move_to([3.5, 0.3, 0])
        self.add(circle, dot, square)

        c_label = Text("Indicate", font_size=26, color=BLUE)
        c_label.move_to([-3.5, -1.8, 0])
        f_label = Text("Flash", font_size=26, color=RED)
        f_label.move_to([0, -1.8, 0])
        s_label = Text("Circumscribe", font_size=26, color=YELLOW)
        s_label.move_to([3.5, -1.8, 0])
        self.add(c_label, f_label, s_label)

        self.play(Indicate(circle), Flash(dot), Circumscribe(square))
        # Circumscribe 的圈是过程性的，动画后手算一个矩形圈留在画面作证
        ring = Rectangle(width=1.9, height=1.9, color=PINK)
        ring.move_to([3.5, 0.3, 0])
        self.add(ring)
        self.wait(0.3)
