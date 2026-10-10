"""set_opacity（拆成描边 + 填充）

@expect 描边与填充的透明度一起变淡，颜色不变。"""

from manim import *


class SetOpacityScene(Scene):
    def construct(self):
        circle = Circle(radius=1.4, color=BLUE)
        # 左侧放原浓淡对照、右侧变淡后的：颜色不变、浓淡减半
        full = circle.copy()
        full.shift(LEFT * 2.6)
        circle.set_opacity(0.4)
        circle.shift(RIGHT * 2.6)
        label = Text("透明度 0.4", font_size=28)
        label.move_to([2.6, -2.3, 0])
        self.play(Create(full), Create(circle), Write(label))
        self.wait(0.3)
