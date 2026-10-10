"""next_to 带 buff

@expect 两物体之间留的空隙与 buff 值一致，不贴死也不离太远。
@note manim-web 的 nextTo 把 buff 放在第三个**位置**参数上
"""

from manim import *


class NextToBuffScene(Scene):
    def construct(self):
        circle = Circle(radius=1)
        square = Square(side_length=1.4, color=YELLOW)
        square.next_to(circle, RIGHT, buff=0.5)
        self.play(Create(circle), Create(square))
        self.wait(0.3)
