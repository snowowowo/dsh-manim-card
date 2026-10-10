"""DecimalNumber 数字动画

@expect 数值动画：数字位数 / 小数位按参数显示，动画中数值连续变化。
@note manim-web 的 changeDecimalToValue 收 { targetValue }，第二个位置参数不是目标值
@note 适配层 ChangeDecimalToValue 不生效；改用 ValueTracker + updater 驱动
      DecimalNumber.set_value（真时序可看到数值连续变化——过程，真时序观察）。
      极速模式不执行 updater 帧、终帧停在初值，故动画末尾再用 Transform
      把数字定格到 10，终帧（两种模式）都显示目标值
"""

from manim import *


class DecimalNumberScene(Scene):
    def construct(self):
        tracker = ValueTracker(3.14)
        n = DecimalNumber(3.14, num_decimal_places=2)
        n.move_to([0, 1.5, 0])
        n.add_updater(lambda m: m.set_value(tracker.get_value()))

        start_label = Text("起点 3.14", font_size=28, color=GREY_A)
        start_label.move_to([-3, -1, 0])
        arrow = Arrow([-1.6, -1, 0], [1.6, -1, 0], buff=0.2)
        end_label = Text("终点 10", font_size=28, color=YELLOW)
        end_label.move_to([3, -1, 0])

        self.add(tracker, n)
        self.play(FadeIn(start_label), FadeIn(arrow), FadeIn(end_label))
        self.play(tracker.animate.set_value(10), run_time=2)
        n.clear_updaters()
        final = DecimalNumber(10, num_decimal_places=2)
        final.move_to([0, 1.5, 0])
        self.play(Transform(n, final))
        self.wait(0.3)
