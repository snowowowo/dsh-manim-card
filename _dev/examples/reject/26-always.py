"""always：把函数变成 updater 的通用助手

@expect 不渲染：预检应当**当场**拒绝，报错要提到「always」并给出可读的原因或替代写法。
@reject always

@note manim-web 没有 always——直接写 add_updater(lambda m, dt: ...)
"""

from manim import *


class AlwaysScene(Scene):
    def construct(self):
        square = Square()
        square.add_updater(always(lambda m: m.rotate(0.02), rate=2))
        self.add(square)
        self.wait(0.5)
