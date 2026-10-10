"""pandas：滚动均值曲线

@expect 滚动均值曲线比原始数据平滑、跟随趋势，窗口参数与平滑程度相符。
@note 第三方包那组的第一条：真 import pandas、真算，再把结果交给 Axes 画出来。
      这一组要联网取包，默认不进自动测试（见 examples.test.ts 的 MANIM_NET）。
"""

from manim import *
import numpy as np
import pandas as pd

rng = np.random.default_rng(7)
df = pd.DataFrame({"t": np.arange(24), "v": np.arange(24) * 0.5 + rng.normal(0, 1.2, 24)})
df["smooth"] = df["v"].rolling(3, min_periods=1).mean()
t = df["t"].to_numpy(dtype=float)
v = df["v"].to_numpy(dtype=float)
s = df["smooth"].to_numpy(dtype=float)
print("pandas", pd.__version__, round(float(df["smooth"].iloc[-1]), 3))


class PandasRollingScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 24, 6], y_range=[-2, 14, 4])
        raw = ax.plot(lambda x: float(np.interp(x, t, v)), x_range=[0, 23], color=BLUE)
        smooth = ax.plot(lambda x: float(np.interp(x, t, s)), x_range=[0, 23], color=YELLOW)
        self.play(Create(ax))
        self.play(Create(raw))
        self.play(Create(smooth))
        self.wait(0.3)
