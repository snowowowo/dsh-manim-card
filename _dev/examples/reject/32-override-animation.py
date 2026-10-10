"""override_animation：替换某个动画的默认实现

@expect 不渲染：预检应当**当场**拒绝，报错要提到「override_animation」并给出可读的原因或替代写法。
@reject override_animation

@note manim-web 没有 override_animation——要改效果就直接构造你要的那个动画类
"""

from manim import *


class OverrideAnimationScene(Scene):
    @override_animation(Create)
    def _create_override(self, mobject, **kwargs):
        return FadeIn(mobject)

    def construct(self):
        self.play(Create(Circle()))
