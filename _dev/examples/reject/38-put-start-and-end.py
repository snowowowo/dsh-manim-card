"""Line.put_start_and_end：直接改线的两端

@expect 不渲染：预检应当**当场**拒绝，报错要提到「put_start_and_end」并给出可读的原因或替代写法。
@reject put_start_and_end

@note 用 put_start_and_end_on（适配层翻成 setStart + setEnd）
"""

from manim import *


class PutStartAndEndScene(Scene):
    def construct(self):
        line = Line(LEFT, RIGHT)
        self.add(line)
        line.put_start_and_end(UP, DOWN)
        self.wait(0.3)
