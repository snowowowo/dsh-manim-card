"""综合场景：scipy 解 ODE + numpy 取解 + Manim 画两条对照曲线

@expect 两条对照曲线的形态与 ODE 数值解一致，图例 / 标注齐全。
@note solve_ivp 返回的是一整包解（Bunch），这里用属性访问 + 切片把它拆成可画的曲线，
      再叠一条解析解对照——看「库对象的形状转换」在桥上顺不顺。
"""

from manim import *
import numpy as np
from scipy.integrate import solve_ivp


def damped(t, state):
    x, v = state
    return [v, -0.6 * v - 4.0 * x]


sol = solve_ivp(damped, (0.0, 12.0), [1.0, 0.0], t_eval=np.linspace(0, 12, 240))
ts = sol.t
xs = sol.y[0]
analytic = np.exp(-0.3 * ts) * np.cos(np.sqrt(4.0 - 0.09) * ts)
err = float(np.max(np.abs(xs - analytic)))
print("combo-ode", bool(sol.success), len(ts), round(err, 4))


class ComboOdeScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 12, 2], y_range=[-1.2, 1.2, 0.5])
        curve = ax.plot(lambda x: float(np.interp(x, ts, xs)), x_range=[0, 12], color=BLUE)
        ref = ax.plot(lambda x: float(np.interp(x, ts, analytic)), x_range=[0, 12], color=YELLOW)
        self.play(Create(ax))
        self.play(Create(curve), Create(ref))
        self.wait(0.3)
