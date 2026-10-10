"""CurvesAsSubmobjects：把一条曲线的各段拆成子物体

@expect 不渲染：预检应当**当场**拒绝，报错要提到「CurvesAsSubmobjects」并给出可读的原因或替代写法。
@reject CurvesAsSubmobjects

@note manim-web 没有 CurvesAsSubmobjects——逐段做动画用 ParametricFunction 拆或 VGroup 拼
"""

from manim import *


class CurvesAsSubmobjectsScene(Scene):
    def construct(self):
        arc = Arc(radius=2, start_angle=0, angle=PI)
        curves = CurvesAsSubmobjects(arc)
        self.add(curves)
