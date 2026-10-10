"""scikit-learn：线性回归

@expect 回归直线贴合散点趋势，斜率截距与拟合结果一致。
@note 系数用来画回归线、样本点用 Dot——画面上只有几何，不依赖文本渲染
"""

from manim import *
import numpy as np
from sklearn.linear_model import LinearRegression

rng = np.random.default_rng(3)
x = rng.uniform(0, 10, 40)
y = 2.4 * x + 1.0 + rng.normal(0, 2.0, 40)
model = LinearRegression().fit(x.reshape(-1, 1), y)
k = float(model.coef_[0])
b = float(model.intercept_)
print("lr", round(k, 3), round(b, 3))


class SklearnRegressionScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 10, 2], y_range=[0, 26, 5])
        dots = VGroup(*[Dot(point=ax.c2p(float(xi), float(yi)), color=BLUE) for xi, yi in zip(x, y)])
        line = ax.plot(lambda t: k * t + b, x_range=[0, 10], color=YELLOW)
        self.play(Create(ax), FadeIn(dots))
        self.play(Create(line))
        self.wait(0.3)
