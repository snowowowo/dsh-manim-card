"""FunctionGraph 收函数

@expect 曲线形状与传入的函数一致。
@note CE 关键字叫 function，manim-web 叫 func（表里有 rename）
"""

from manim import *


class FunctionGraphScene(Scene):
    def construct(self):
        ax = Axes(x_range=[-3, 3, 1], y_range=[-1, 2, 1])
        graph = FunctionGraph(func=lambda x: np.sin(x), x_range=[-3, 3], color=YELLOW)
        self.play(Create(ax), Create(graph))
        self.wait(0.3)
