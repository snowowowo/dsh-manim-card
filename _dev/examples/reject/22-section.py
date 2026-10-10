"""Section：把动画切成可检索的段落

@expect 不渲染：预检应当**当场**拒绝，报错要提到「Section」并给出可读的原因或替代写法。
@reject Section

@note manim-web 没有 Section（CE 用它给视频切章）——分段直接用多个 play 组
"""

from manim import *


class SectionScene(Scene):
    def construct(self):
        intro = Section("开场")
        self.add(Circle())
        self.wait(0.3)
