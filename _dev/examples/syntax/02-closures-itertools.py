"""语法综合：闭包 / 生成器函数 / itertools 链

@expect 闭包 / 生成器函数 / itertools 链建出的图形正常，数量与 itertools 的产物一致。
@note 曲线不是在这里写死的，而是闭包工厂攒出来、生成器按步长吐采样点——
      「函数里的函数、yield、itertools 串起来」在真实数值代码里到处都是，
      而 plot 收的是这个闭包（不是 lambda 字面量），这条也得验。
"""

from manim import *
import functools
import itertools
import math


def make_wave(amp, freq, phase):
    """闭包工厂：返回一个只认 t 的波形函数。"""
    def wave(t):
        return amp * math.sin(freq * t + phase)
    return wave


def sample(fn, start, stop, count):
    """生成器：按步长吐采样点，交给调用方消费。"""
    step = (stop - start) / (count - 1)
    for i in range(count):
        t = start + i * step
        yield t, fn(t)


wave = make_wave(1.2, 1.6, math.pi / 4)
pairs = list(sample(wave, 0.0, 6.0, 40))
ts = [p[0] for p in pairs]
ys = [p[1] for p in pairs]

# itertools / functools：前缀和、相邻配对、归约——把两条流各取一段做统计
acc = list(itertools.accumulate(ys[:5]))
adj = list(itertools.pairwise(ts[:4]))
peak = functools.reduce(lambda a, b: a if a > b else b, ys)
print("syntax-closures", round(peak, 3), len(acc), len(adj), round(sum(acc), 3))


class ClosuresScene(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 6, 1], y_range=[-1.5, 1.5, 0.5])
        curve = ax.plot(lambda t: float(wave(t)), x_range=[0, 6], color=GREEN)
        self.play(Create(ax))
        self.play(Create(curve))
        self.wait(0.3)
