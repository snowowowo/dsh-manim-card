"""DecimalNumber 数字动画

@expect 数值动画：数字位数 / 小数位按参数显示，动画中数值连续变化。
@note manim-web 的 changeDecimalToValue 收 { targetValue }，第二个位置参数不是目标值
"""

from manim import *


class DecimalNumberScene(Scene):
    def construct(self):
        n = DecimalNumber(3.14, num_decimal_places=2)
        n.to_edge(UP)
        self.play(FadeIn(n))
        self.play(ChangeDecimalToValue(n, 10))
        self.wait(0.3)
