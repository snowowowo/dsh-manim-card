"""Surface：参数曲面

@expect 不渲染：预检应当**当场**拒绝，报错要提到「Surface」并给出可读的原因或替代写法。
@reject Surface

@note CE 的 3D 曲面在 manim-web 没有——替代是用 ParametricFunction 画面片投影
"""

from manim import *


class SurfaceScene(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        surface = Surface(lambda u, v: axes.c2p(u, v, u * v), u_range=[-2, 2], v_range=[-2, 2])
        self.add(axes, surface)
