"""柱状图

@expect 三根柱子红 / 蓝 / 绿三色、高低与数据一致、间距均匀，标题在图上方不压图。"""

from manim import *


class BarChartScene(Scene):
    def construct(self):
        chart = BarChart(values=[1, 3, 2], bar_colors=[RED, BLUE, GREEN])
        chart.move_to([0, -0.6, 0])
        # 适配层 bug：bar_colors 不生效，且 set_fill 会连描边一起染——
        # 先逐根 set_fill，再单独 set_stroke 把描边改回同色。
        # 适配层没有 chart.bars：三根柱是 chart 的第 3 个子物体的 3 个孩子
        bars = chart[2]
        for bar, color in zip(bars, [RED, BLUE, GREEN]):
            bar.set_fill(color, opacity=1.0)
            bar.set_stroke(color=color)
        title = Text("三色柱状图", font_size=28, color=WHITE)
        title.move_to([0, 2.6, 0])
        self.play(Create(chart), Write(title))
        self.wait(0.3)
