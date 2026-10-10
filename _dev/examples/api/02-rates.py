"""API 点名：全部 16 个速率函数

@expect 十六行，每行一个速率名 + 一颗圆点：圆点都从左走到右、走完同样的距离，
        但每一行的节奏就是它的名字——smooth 先快后缓、rush_into 起步就冲、
        there_and_back 走到头又折返回来、wiggle 原地抖几下。看的不是终点，是「怎么走」。

@note 三态表里 kind=rate、state=ok 的名字逐个点一遍。以前语料只用到 smooth 与 there_and_back，
      其余名字写错（或桥的 rateFunction 拿不到、柯里化没先调一次）要等用户随手写一次才暴露。
      rate_func 传的是速率**名**（字符串），所以这里用 globals() 按名取——名字写在清单里，
      「谁被覆盖了」在源码上看得见（不是循环拼出来的）。
      旧版把 16 颗点先后 Create 出来，速率根本没得看——速率是「时间怎么分配」，必须让物体
      真的走一段路才看得出来。
"""

from manim import *

RATES = [
    "double_smooth",
    "exponential_decay",
    "linear",
    "lingering",
    "not_quite_there",
    "running_start",
    "rush_from",
    "rush_into",
    "slow_into",
    "smooth",
    "smoothererstep",
    "smootherstep",
    "smoothstep",
    "there_and_back",
    "there_and_back_with_pause",
    "wiggle",
]

print("api-rates", len(RATES), all(isinstance(globals()[name], str) for name in RATES))

X0 = -4.0
SPAN = 8.0
TOP = 3.6
STEP = 0.46


class ApiRatesScene(Scene):
    def construct(self):
        dots = []
        for i, name in enumerate(RATES):
            y = TOP - i * STEP
            label = Text(name, font_size=13).move_to([-5.8, y, 0])
            track = Line([X0, y, 0], [X0 + SPAN, y, 0]).set_stroke(width=1.5, opacity=0.25)
            dot = Dot([X0, y, 0], radius=0.09)
            self.add(label, track, dot)
            dots.append(dot)
        for i, name in enumerate(RATES):
            self.play(dots[i].animate.shift([SPAN, 0, 0]), rate_func=globals()[name], run_time=1.1)
        self.wait(0.2)
