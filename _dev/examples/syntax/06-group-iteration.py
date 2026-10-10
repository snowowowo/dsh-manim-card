"""语法综合：遍历 VGroup（for / 推导式 / 越界下标）

@expect for 遍历 VGroup 正常收尾（不无限取下去），越界下标抛 IndexError。
@note `for m in group:` 是最常见的 Manim 写法之一，它曾经会**卡死**：适配层越界取不到时
      不抛 IndexError，于是迭代永远取得到「下一个」，越取越多直到把内存吃满（真机事故）。
      这条语料就是那次的回归网——for 遍历、推导式遍历、越界下标（必须抛 IndexError）都要走通。
"""

from manim import *
import math

dots = VGroup(*[Dot(point=[1.2 * i - 2.4, 0, 0], color=BLUE) for i in range(5)])

# for 遍历：走 __iter__（内部靠越界 IndexError 收尾）
moved = 0
for m in dots:
    m.shift(UP * 0.4)
    moved += 1

# 推导式遍历：同样要收尾
ys = [round(float(m.get_center()[1]), 3) for m in dots]

# 越界下标必须当场抛 IndexError，不能悄悄给个空物体（给了就又是那个死循环）
try:
    dots[99]
    tail = "no-error"
except IndexError:
    tail = "index-error"

print("syntax-group-iteration", moved, len(ys), ys[0], tail)


class GroupIterationScene(Scene):
    def construct(self):
        self.play(FadeIn(dots))
        for m in dots:
            m.set_color(YELLOW)
        self.play(dots.animate.shift(DOWN * 0.4))
        self.wait(0.3)
