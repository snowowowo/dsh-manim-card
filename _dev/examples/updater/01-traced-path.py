"""TracedPath 跟随物体

@expect 点移动时身后拖出一条轨迹线，轨迹与走过的路径重合。
@note ⚠️ 与 CE 写法不同：CE 收函数 dot.get_center，manim-web 收物体本身——技能文档已注明
"""

from manim import *


class TracedPathScene(Scene):
    def construct(self):
        dot = Dot(point=[-3, 0, 0], color=RED)
        path = TracedPath(dot, stroke_color=YELLOW)
        self.add(path, dot)
        self.play(dot.animate.shift(RIGHT * 6))
        self.wait(0.3)
