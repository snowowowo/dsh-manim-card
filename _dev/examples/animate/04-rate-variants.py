"""there_and_back 速率

@expect 物体走到目标后又原路折返回起点（there_and_back 的标志性行为）。
        折返是过程性的——真时序观察；终帧圆回到起点，目标点与虚线路径
        留在画面上作证据，圆旁标注 there_and_back。
@note rate_func 传的是速率**名**（字符串），自定义函数过不了桥
"""

from manim import *


class RateVariantsScene(Scene):
    def construct(self):
        circle = Circle(radius=1.2, color=BLUE)
        circle.move_to([-3, 0, 0])
        self.play(Create(circle))

        target = Dot([0, 0, 0], color=RED, radius=0.12)
        path = DashedLine([-1.8, 0, 0], [0, 0, 0], color=GREY_D)
        label = Text("there_and_back", font_size=28, color=YELLOW)
        label.move_to([-3, 2, 0])
        self.play(FadeIn(target), FadeIn(path), FadeIn(label))

        # 走到目标（RIGHT*3）又原路折返回起点——终帧回到起点，路径与目标点留证
        self.play(circle.animate.shift(RIGHT * 3), rate_func=there_and_back, run_time=2)
        self.wait(0.3)
