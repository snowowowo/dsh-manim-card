"""f_always：按函数返回的参数驱动方法

@expect 不渲染：预检应当**当场**拒绝，报错要提到「f_always」并给出可读的原因或替代写法。
@reject f_always

@note manim-web 没有 f_always——业务逻辑写进 add_updater 的闭包里
"""

from manim import *


class FAlwaysScene(Scene):
    def construct(self):
        dot = Dot(LEFT * 2)
        dot.add_updater(f_always(dot.move_to, lambda: RIGHT * 2))
        self.add(dot)
        self.wait(0.5)
