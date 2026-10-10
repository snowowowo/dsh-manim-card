"""set_fill 关键字不透明度

@expect 填充色变成指定颜色、透明度生效，描边不受影响。
@note manim-web 的 setFill 把不透明度放在**第二个位置参数**，关键字直传会静默错位
"""

from manim import *


class SetFillScene(Scene):
    def construct(self):
        square = Square(side_length=2)
        square.set_fill(BLUE, opacity=0.5)
        self.play(Create(square))
        self.wait(0.3)
