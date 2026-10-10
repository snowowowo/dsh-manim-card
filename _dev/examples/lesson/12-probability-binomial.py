"""概率：二项分布

@expect 二项分布的柱状图呈中间高两边低的钟形，参数决定胖瘦。
@note 讲解模板：n 次试验成功 k 次的概率——柱状图随 n 变大而变高变窄
"""

from manim import *
import math


class BinomialScene(Scene):
    def construct(self):
        counts = [math.comb(10, k) * 0.5 ** 10 for k in range(11)]
        chart = BarChart(values=counts, bar_colors=[GREEN])
        title = MathTex(r"n=10,\ p=0.5").to_edge(UP)

        self.play(Write(title))
        self.play(Create(chart))
        self.wait(0.3)
