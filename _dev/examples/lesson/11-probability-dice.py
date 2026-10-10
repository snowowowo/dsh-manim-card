"""概率：投骰子的频率

@expect 掷骰子次数越多，六面的频率柱越来越齐平（趋近均匀）。
@note 讲解模板：BarChart 画实测频率，与理论值 1/6 对照
"""

from manim import *


class DiceFrequencyScene(Scene):
    def construct(self):
        observed = [0.15, 0.18, 0.16, 0.17, 0.16, 0.18]
        chart = BarChart(values=observed, bar_colors=[BLUE])
        title = Text("投骰子 600 次的频率", font_size=34).to_edge(UP)

        self.play(Write(title))
        self.play(Create(chart))
        self.wait(0.3)
