"""Title 标题

@expect 标题居中出现在画面顶部，字号大于正文。"""

from manim import *


class TitleScene(Scene):
    def construct(self):
        title = Title("摆动")
        circle = Circle(radius=1)
        self.play(Write(title))
        self.play(Create(circle))
        self.wait(0.3)
