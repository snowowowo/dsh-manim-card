"""语法综合：解包 / 格式化 / 切片与排序

@expect 解包 / 格式化 / 切片排序的结果正确（print 断言为准）。
@note 字符串格式化、星号解包、切片、sorted(key=...)、字典合并这些「胶水语法」
      在真实脚本里密度最高——这里把它们全塞进一段能画出图来的代码，
      看这些语法生成的数值与颜色能不能一路走到画布。
"""

from manim import *
import math

rows = [("a", 0.4, BLUE), ("b", 0.9, GREEN), ("c", 1.3, YELLOW), ("d", 0.7, RED)]

# 星号解包把每行拆成三列
names, values, colors = zip(*rows)
values = list(values)
colors = list(colors)

# 排序（按值倒序）——sorted(key=...) 返回新表
ranked = sorted(zip(names, values), key=lambda pair: pair[1], reverse=True)
# 切片带步长
odds = values[::2]

# 字典合并 + 字典推导 + f-string 格式化
meta = {"n": len(rows), **{name: round(v, 2) for name, v in zip(names, values)}}
summary = " ".join(f"{name}={v:.2f}" for name, v in ranked)
print("syntax-glue", summary, meta["n"], f"{odds[0]:.1f}", round(math.fsum(values), 3))

circles = [Circle(radius=v).set_color(c).move_to([1.2 * i - 1.8, 0, 0]) for i, (v, c) in enumerate(zip(values, colors))]
group = VGroup(*circles)


class GlueScene(Scene):
    def construct(self):
        self.play(LaggedStart(*[GrowFromCenter(c) for c in group], lag_ratio=0.15))
        self.play(group.animate.shift(UP * 0.3))
        self.wait(0.3)
