"""SpecialThreeDScene：带三维相机预设的场景

@expect 不渲染：预检应当**当场**拒绝，报错要提到「SpecialThreeDScene」并给出可读的原因或替代写法。
@reject SpecialThreeDScene

@note manim-web 只有 Scene / ThreeDScene——相机朝向要自己 set_camera_orientation
"""

from manim import *


class SpecialThreeDSceneDemo(SpecialThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        self.add(axes)
