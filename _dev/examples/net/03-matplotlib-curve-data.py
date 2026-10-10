"""matplotlib：取它算好的曲线交给 Manim 画

@expect 用 matplotlib 算出的数据点交给 Manim 画，曲线形状与数据一致。
@note 不把 matplotlib 的图直接贴上来（那是另一条路），而是取它算好的 x/y 数据。
      「matplotlib 负责算、Manim 负责画」在浏览器里最稳——不碰 Agg 的离屏渲染。
"""

from manim import *
import numpy as np
import matplotlib
import matplotlib.pyplot as plt

xs_in = np.linspace(0, 6, 60)
fig, mpl_ax = plt.subplots()
mpl_ax.plot(xs_in, np.sin(xs_in))
line = mpl_ax.lines[0]
xs = line.get_xdata().astype(float)
ys = line.get_ydata().astype(float)
plt.close(fig)
print("matplotlib", matplotlib.__version__, len(xs))


class MatplotlibScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 6, 1], y_range=[-1, 1, 0.5])
        curve = ax.plot(lambda x: float(np.interp(x, xs, ys)), x_range=[0, 6], color=GREEN)
        self.play(Create(ax))
        self.play(Create(curve))
        self.wait(0.3)
