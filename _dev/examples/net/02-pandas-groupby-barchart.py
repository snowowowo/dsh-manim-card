"""pandas 分组统计 → 柱状图

@expect 分组柱状图的高度与分组统计值一致。
@note 分组算出来的均值直接当 BarChart 的 values：这是「先用 pandas 算、再用 Manim 画」的主路径
"""

from manim import *
import pandas as pd

df = pd.DataFrame(
    {
        "kind": ["a", "b", "a", "c", "b", "a", "c", "c"],
        "value": [3.0, 1.0, 2.0, 4.0, 5.0, 6.0, 2.0, 1.0],
    }
)
means = df.groupby("kind")["value"].mean().sort_index()
values = [float(x) for x in means.to_numpy()]
print("groupby", [round(x, 2) for x in values])


class PandasGroupByScene(Scene):
    def construct(self):
        chart = BarChart(values=values, bar_colors=[RED, BLUE, GREEN])
        self.play(Create(chart))
        self.wait(0.3)
