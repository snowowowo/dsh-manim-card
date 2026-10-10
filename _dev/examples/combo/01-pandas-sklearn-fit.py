"""综合场景：pandas 洗数 → sklearn 拟合 → Manim 画线

@expect 数据点散布 + 拟合直线：直线贴合数据趋势，斜率截距与 sklearn 的结果一致。
@note 多库协同的真实样子：pandas 管表、sklearn 管模型、numpy 管数值、manim 管画面。
      一段里同时用到 DataFrame 构造、train_test_split、Pipeline(缩放+回归)、predict 与向量化——
      单库的简单例子预测不了这种链路会不会在按需取包后出问题。
"""

from manim import *
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

rng = np.random.default_rng(11)
n = 60
df = pd.DataFrame({"x": rng.uniform(0, 10, n)})
df["y"] = 2.1 * df["x"] + 1.5 + rng.normal(0, 1.6, n)

x_train, x_test, y_train, y_test = train_test_split(df[["x"]], df["y"], test_size=0.25, random_state=0)
model = Pipeline([("scale", StandardScaler()), ("lin", LinearRegression())])
model.fit(x_train, y_train)
score = float(model.score(x_test, y_test))

xs = np.linspace(0, 10, 50)
pred = model.predict(pd.DataFrame({"x": xs}))
slope = float(model.named_steps["lin"].coef_[0])
print("combo-sklearn", round(score, 3), round(slope, 3), round(float(pred[0]), 3))

px = df["x"].to_numpy(dtype=float)
py = df["y"].to_numpy(dtype=float)
fx = xs.astype(float)
fy = np.asarray(pred, dtype=float)


class ComboSklearnScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 10, 2], y_range=[0, 24, 4])
        dots = VGroup(*[Dot(point=ax.c2p(float(a), float(b)), color=BLUE) for a, b in zip(px, py)])
        line = ax.plot(lambda t: float(np.interp(t, fx, fy)), x_range=[0, 10], color=YELLOW)
        self.play(Create(ax), FadeIn(dots))
        self.play(Create(line))
        self.wait(0.3)
