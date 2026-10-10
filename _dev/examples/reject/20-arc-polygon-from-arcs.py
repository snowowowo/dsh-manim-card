"""ArcPolygonFromArcs：用现成的弧拼多边形

@expect 不渲染：预检应当**当场**拒绝，报错要提到「ArcPolygonFromArcs」并给出可读的原因或替代写法。
@reject ArcPolygonFromArcs

@note manim-web 没有 ArcPolygonFromArcs——用 ArcPolygon（自己给顶点）代替
"""

from manim import *


class ArcPolygonFromArcsScene(Scene):
    def construct(self):
        first = ArcBetweenPoints(LEFT, UP, angle=PI / 2)
        second = ArcBetweenPoints(UP, RIGHT, angle=PI / 2)
        shape = ArcPolygonFromArcs(first, second)
        self.add(shape)
