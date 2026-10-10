"""两位数标签贴右上角

@expect 两位数标签贴在目标右上角，不出画、不叠在目标上（这是修过的定位事故）。
@note 2026-10-09 事故：KaTeX 排版是异步的，定位时宽度还是 0，两位数标签被顶出画面
"""

from manim import *


class MathtexCornerScene(Scene):
    def construct(self):
        label = MathTex("n=61")
        label.to_corner(UR)
        self.play(Write(label))
        self.wait(0.3)
