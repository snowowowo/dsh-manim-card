"""set_opacity（拆成描边 + 填充）

@expect 描边与填充的透明度一起变淡，颜色不变。"""

from manim import *


class SetOpacityScene(Scene):
    def construct(self):
        circle = Circle(radius=1.4, color=BLUE)
        circle.set_opacity(0.4)
        self.play(Create(circle))
        self.wait(0.3)
