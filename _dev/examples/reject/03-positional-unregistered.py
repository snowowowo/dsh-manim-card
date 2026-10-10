"""未登记类的位置参数

@expect 不渲染：预检应当**当场**拒绝，报错要提到「Cutout」并给出可读的原因或替代写法。
@reject Cutout

@note 构造表是人工残留：没登记的类拒收位置参数，让调用方改关键字形式
"""

from manim import *


class PositionalUnregisteredScene(Scene):
    def construct(self):
        cut = Cutout(Square(side_length=2), Circle(radius=0.5))
        self.add(cut)
