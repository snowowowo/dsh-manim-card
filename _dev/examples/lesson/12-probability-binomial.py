"""概率：二项分布

@expect 二项分布的柱状图呈中间高两边低的钟形（最高柱约 0.25，向两侧逐级递减），参数决定胖瘦。
@note 讲解模板：n 次试验成功 k 次的概率——柱状图随 n 变大而变高变窄；
      MathTex 标题禁用 to_edge（包围盒 NaN 会整条飞出画框），改 move_to；
      BarChart 默认摆位偏右上、刻度被上缘裁，需 move_to 居中偏下并收紧 y_range；
      适配层 BarChart 的 x 编号默认从 1 起计（画面标签 1..11 对应 k=0..10），docstring 勿写死 k 编号
"""

from manim import *
import math


class BinomialScene(Scene):
    def construct(self):
        counts = [math.comb(10, k) * 0.5 ** 10 for k in range(11)]
        chart = BarChart(
            values=counts,
            y_range=[0, 0.3, 0.1],
            bar_colors=[GREEN],
        )
        chart.move_to([0, -0.7, 0])
        title = MathTex(r"n=10,\ \ p=0.5").move_to([0, 3.4, 0])

        self.play(Write(title))
        self.play(Create(chart))
        self.wait(0.3)
