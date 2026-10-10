"""add 收动画会当场报错

@expect 不渲染：add 收到动画要被当场拒，报错说清「动画要用 play」。
@reject 动画

@note self.add 只收物体；校验在 Python 侧，预检也拦得住（2026-10 已接线）
"""

from manim import *


class AddAnimationScene(Scene):
    def construct(self):
        circle = Circle()
        self.add(Create(circle))
