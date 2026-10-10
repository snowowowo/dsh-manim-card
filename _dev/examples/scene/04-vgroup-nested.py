"""VGroup 套 VGroup

@expect 嵌套组整体动、子组也单独动，两层互不串。
自证：外层整体上移后红点跟着走，内层再单独变黄、红点颜色不变。"""

from manim import *


class VgroupNestedScene(Scene):
    def construct(self):
        inner = VGroup(Circle(radius=0.4), Square(side_length=0.6))
        inner.arrange(RIGHT, buff=0.3)
        outer = VGroup(inner, Dot(point=[0, -1.5, 0], color=RED))
        self.play(FadeIn(outer))
        # 第一步：外层整体上移——圆、方、红点一起动
        self.play(outer.animate.shift(UP * 0.8))
        # 第二步：内层单独变色——只有圆和方变黄，红点不动也不变色
        self.play(inner.animate.set_color(YELLOW))
        note = Text("外层整体上移，内层单独变色", font_size=24).move_to([0, -3.2, 0])
        self.play(FadeIn(note))
        self.wait(0.3)
