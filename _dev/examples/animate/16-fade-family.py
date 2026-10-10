"""FadeIn / FadeOut

@expect FadeIn 是从透明渐显、FadeOut 是渐隐到消失，其余状态不变。
        渐显/渐隐是过程性的——真时序观察；终帧可读的证据：
        顶部标题全程在场作参照，FadeIn 的三角保持可见，FadeOut 的圆终态消失。
"""

from manim import *


class FadeFamilyScene(Scene):
    def construct(self):
        title = Text("FadeIn 留下 / FadeOut 消失", font_size=28, color=GREY_A)
        title.move_to([0, 3.0, 0])
        self.add(title)

        circle = Circle(radius=1.2, color=BLUE)
        circle.move_to([-3, -0.5, 0])
        triangle = Triangle(color=GREEN)
        triangle.move_to([3, -0.5, 0])
        c_label = Text("FadeOut → 不在", font_size=24, color=BLUE)
        c_label.move_to([-3, -2.5, 0])
        t_label = Text("FadeIn → 在", font_size=24, color=GREEN)
        t_label.move_to([3, -2.5, 0])
        self.play(FadeIn(circle, shift=UP * 0.5), FadeIn(triangle), FadeIn(c_label), FadeIn(t_label))
        self.play(FadeOut(circle))
        self.wait(0.3)
