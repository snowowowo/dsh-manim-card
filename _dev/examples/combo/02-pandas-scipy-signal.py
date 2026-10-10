"""综合场景：pandas 滚动统计 + scipy.signal 平滑与寻峰

@expect 原始数据、平滑后的曲线、寻峰标记三层都在：峰位与数据特征对得上。
@note 时序数据三件套：pandas 造表与滚动、scipy 滤波去噪与找峰、numpy 管索引。
      峰值点回画布上标出来，数据链路从表一路走到画面——跨三库的索引对齐最容易出问题。
"""

from manim import *
import numpy as np
import pandas as pd
from scipy.signal import find_peaks, savgol_filter

rng = np.random.default_rng(3)
t = np.arange(80)
base = 2.0 + np.sin(t / 6.0) * 1.5
df = pd.DataFrame({"t": t, "v": base + rng.normal(0, 0.35, 80)})
df["smooth"] = savgol_filter(df["v"].to_numpy(dtype=float), 9, 3)
df["roll"] = df["smooth"].rolling(5, min_periods=1).mean()

smooth = df["smooth"].to_numpy(dtype=float)
ts = df["t"].to_numpy(dtype=float)
peaks, _props = find_peaks(smooth, distance=6, prominence=0.4)
print("combo-scipy", len(peaks), int(peaks[0]), round(float(df["roll"].iloc[-1]), 3))


class ComboSignalScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 80, 20], y_range=[0, 4, 1])
        curve = ax.plot(lambda x: float(np.interp(x, ts, smooth)), x_range=[0, 79], color=GREEN)
        marks = VGroup(*[Dot(point=ax.c2p(float(ts[i]), float(smooth[i])), color=RED) for i in peaks])
        self.play(Create(ax))
        self.play(Create(curve), FadeIn(marks))
        self.wait(0.3)
