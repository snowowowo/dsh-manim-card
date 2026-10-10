"""概率：投骰子的频率

@expect 掷骰子次数越多，六面的频率柱越来越齐平（趋近均匀）：六根柱几乎等高（15%–18%），
实测值都贴着理论值 16.7% 的橙色虚线附近起伏。
@template 要画「随机模拟 + 频率柱状图 + 理论值对照线」（大数定律、蒙特卡洛这类实验对照理论）时照它抄。
@note 讲解模板：BarChart 画实测频率，与理论值 1/6 对照；BarChart 默认摆位偏右上、
      上缘刻度会被裁，需整体 move_to 居中偏下并收紧 y_range；刻度用整数百分比
      （适配层把两位小数刻度标签四舍五入到一位，0.05 步进会显示成重复的 0.2/0.1）；
      BarChart 实例不挂 c2p（只有 Axes 桥接），参考线按图表几何手算绝对坐标
"""

from manim import *


class DiceFrequencyScene(Scene):
    def construct(self):
        observed_pct = [15, 18, 16, 17, 16, 18]
        chart = BarChart(
            values=observed_pct,
            y_range=[0, 20, 5],
            bar_colors=[BLUE],
        )
        chart.move_to([0, -0.7, 0])
        title = Text("投骰子 600 次的频率", font_size=34).move_to([0, 3.4, 0])

        # 理论值 1/6=16.7% 的参考线：量程 20 对应轴高 5 单位（默认 y_length），
        # 16.7% 高度 = 16.7/20*5 ≈ 4.2；轴底经实测标定在 y≈-3.0
        guide = DashedLine(
            [-1.9, -3.0 + 16.7 / 20 * 5, 0],
            [1.9, -3.0 + 16.7 / 20 * 5, 0],
            color=ORANGE,
            stroke_width=2.5,
        )
        guide_label = Text("1/6 ≈ 16.7%", font_size=22, color=ORANGE)
        guide_label.move_to([2.9, -3.0 + 16.7 / 20 * 5, 0])

        self.play(Write(title))
        self.play(Create(chart))
        self.play(Create(guide), Write(guide_label))
        self.wait(0.3)
