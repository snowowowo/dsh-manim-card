"""manim-web 没有的类

@expect 不渲染：预检应当**当场**拒绝，报错要提到「FancyWidget」并给出可读的原因或替代写法。
@reject FancyWidget
"""

from manim import *


class UnknownClassScene(Scene):
    def construct(self):
        thing = FancyWidget(radius=1)
        self.add(thing)
