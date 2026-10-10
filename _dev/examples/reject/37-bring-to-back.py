"""bring_to_back：把物体压到最下层

@expect 不渲染：预检应当**当场**拒绝，报错要提到「bring_to_back」并给出可读的原因或替代写法。
@reject bring_to_back

@note manim-web 没有 Scene 级层级重排——用 set_z(数值) 调层级
"""

from manim import *


class BringToBackScene(Scene):
    def construct(self):
        square = Square(color=BLUE, fill_opacity=1)
        circle = Circle(color=YELLOW, fill_opacity=1)
        self.add(square, circle)
        circle.bring_to_back()
        self.wait(0.3)
