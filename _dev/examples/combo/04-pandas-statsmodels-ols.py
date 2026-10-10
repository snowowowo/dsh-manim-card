"""综合场景：pandas 造表 → statsmodels OLS 拟合与预测 → Manim 画回归

@expect 造表、拟合、画回归一条龙：拟合线贴合数据，预测点落在合理位置。
@note OLS 吃 pandas 时参数名来自列名，predict 要同形状的外生变量表。
      残差、RMSE 这些统计量与画面同源——验「统计库产出的 pandas 对象」能不能顺着链路走下去。
"""

from manim import *
import numpy as np
import pandas as pd
import statsmodels.api as sm

rng = np.random.default_rng(9)
n = 40
df = pd.DataFrame({"x": rng.uniform(0, 6, n)})
df["y"] = 1.4 * df["x"] + 2.0 + rng.normal(0, 0.8, n)

exog = sm.add_constant(df["x"])
fit = sm.OLS(df["y"], exog).fit()
df["fit"] = fit.predict(exog)
df["resid"] = df["y"] - df["fit"]
rmse = float(np.sqrt(np.mean(df["resid"].to_numpy(dtype=float) ** 2)))
print("combo-statsmodels", round(float(fit.params["x"]), 3), round(float(fit.rsquared), 3), round(rmse, 3))

gx = np.linspace(0, 6, 60)
lx = gx.astype(float)
ly = np.asarray(fit.params["const"] + fit.params["x"] * gx, dtype=float)
px = df["x"].to_numpy(dtype=float)
py = df["y"].to_numpy(dtype=float)


class ComboOlsScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 6, 1], y_range=[0, 12, 2])
        dots = VGroup(*[Dot(point=ax.c2p(float(a), float(b)), color=BLUE) for a, b in zip(px, py)])
        lin = ax.plot(lambda t: float(np.interp(t, lx, ly)), x_range=[0, 6], color=YELLOW)
        self.play(Create(ax), FadeIn(dots))
        self.play(Create(lin))
        self.wait(0.3)
