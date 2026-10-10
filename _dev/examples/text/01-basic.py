"""Text 文字

@expect 文字以真实字形渲染出来（不是方框 / 乱码），内容一致。"""

from manim import *


class BasicScene(Scene):
    def construct(self):
        hello = Text("你好，Manim", font_size=48)
        self.play(Write(hello))
        self.wait(0.3)
