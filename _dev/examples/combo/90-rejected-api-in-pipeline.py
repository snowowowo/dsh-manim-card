"""综合场景被拒：多库链路踩到缺失的 Manim 能力

@expect 不渲染：预检应当**当场**拒绝，报错要提到「always_redraw」并给出可读的原因或替代写法。
@reject always_redraw

@note 前面几条库都用对了，却在一个 manim-web 缺失的能力上翻车——真实事故常这样：
      数据链路全对，卡在最后一步画不出来。拒绝必须指到那一步，且不因前面 import 了一堆库而含糊。
"""

from manim import *
import numpy as np
import pandas as pd

df = pd.DataFrame({"x": np.linspace(0, 4, 20)})
df["y"] = np.sin(df["x"])
ys = df["y"].to_numpy(dtype=float)


class ComboRejectScene(Scene):
    def construct(self):
        dot = Dot()
        curve = always_redraw(lambda: Line([0, 0, 0], dot.get_center()))
        self.add(curve)
        self.play(dot.animate.shift([2.0, float(ys[-1]), 0]))
        self.wait(0.2)
