"""曲线下的面积

@expect 曲线与 x 轴之间一块半透明填充，边界就是曲线段。
@note manim-web 的 getArea 把 xRange 放在第二个位置参数，颜色那几项才进选项
"""

from manim import *


class AreaScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 4, 1], y_range=[0, 4, 1])
        graph = ax.plot(lambda x: x, color=GREEN)
        area = ax.get_area(graph, x_range=[0, 2], color=BLUE, opacity=0.5)
        self.play(Create(ax), Create(graph), FadeIn(area))
        self.wait(0.3)
