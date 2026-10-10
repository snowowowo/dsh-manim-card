"""速率与时长（rate_func 对照）

@expect 两个物体从左到右位移同样距离、run_time 相同，一个 rate_func=linear、
        一个 rate_func=smooth，各自旁标注速率名；画面留两条路径的起终点标记。
        急缓差异（smooth 两头慢中间快）是过程性的——真时序观察；终帧以
        「路径 + 起终点标记 + 速率名标注」的对照定格作证。
@note rate_func 传的是速率**名**（字符串），自定义函数过不了桥
"""

from manim import *


class RateFuncScene(Scene):
    def construct(self):
        rows = [
            (-1.5, "linear", BLUE),
            (-3.0, "smooth", ORANGE),
        ]
        for y, name, color in rows:
            start = Dot([-4.5, y, 0], color=GREY_A, radius=0.08)
            end = Dot([4.5, y, 0], color=GREY_A, radius=0.08)
            path = DashedLine([-4.5, y, 0], [4.5, y, 0], color=GREY_D)
            label = Text(name, font_size=28, color=color)
            label.move_to([5.8, y, 0])
            self.add(start, end, path, label)

        top = Dot([-4.5, -1.5, 0], color=BLUE, radius=0.18)
        bottom = Dot([-4.5, -3.0, 0], color=ORANGE, radius=0.18)
        self.add(top, bottom)
        # 同样的位移、同样的 run_time，只差速率：快慢差别在真时序里肉眼可分
        self.play(top.animate.shift(RIGHT * 9), rate_func=linear, run_time=2)
        self.play(bottom.animate.shift(RIGHT * 9), rate_func=smooth, run_time=2)
        title = Text("快慢差异：过程，真时序观察", font_size=26, color=GREY_A)
        title.move_to([0, 3.0, 0])
        self.play(FadeIn(title))
        self.wait(0.3)
