"""statsmodels：OLS 拟合

@expect OLS 拟合线贴合数据，预测 / 区间元素齐全。
@note 拟合参数与 R² 用 print 带出来（画面上只留那条回归线）
"""

from manim import *
import numpy as np
import statsmodels.api as sm

rng = np.random.default_rng(5)
x = rng.uniform(1, 8, 30)
y = 1.8 * x + 0.5 + rng.normal(0, 1.0, 30)
fit = sm.OLS(y, sm.add_constant(x)).fit()
slope = float(fit.params[1])
intercept = float(fit.params[0])
print("ols", round(slope, 3), round(intercept, 3), round(float(fit.rsquared), 3))


class StatsmodelsOlsScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 8, 2], y_range=[0, 16, 4])
        dots = VGroup(*[Dot(point=ax.c2p(float(xi), float(yi)), color=BLUE) for xi, yi in zip(x, y)])
        line = ax.plot(lambda t: slope * t + intercept, x_range=[0, 8], color=YELLOW)
        self.play(Create(ax), FadeIn(dots))
        self.play(Create(line))
        self.wait(0.3)
