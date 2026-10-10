"""语法综合：推导式 / 解包 / 生成器表达式一起建图

@expect 推导式 / 解包 / 生成器表达式建出的图形数量与排布和源码逻辑一致（print 断言为准）。
@note 离线组（不取第三方包，默认套件就跑）。这一组验的是**语法复杂度**而不是某个库：
      真实代码很少一段里只用一个特性——推导式套条件、生成器喂给 VGroup、zip/enumerate/
      解包混着用才是常态，只看简单例子预测不了这些会不会在桥上出问题。
"""

from manim import *
import math

COUNT = 9
palette = [BLUE, GREEN, YELLOW, RED, PURPLE, TEAL, ORANGE, PINK, MAROON]

# 列表推导 + 条件筛选 + 海象运算符
radii = [r for i in range(1, COUNT + 1) if (r := 0.18 * i) <= 1.7]
assert len(radii) == COUNT

# 推导式里直接链式构造（move_to / set_color 都返回自身，见 method/13-copy.py 同款）
circles = [Circle(radius=r).set_color(palette[i % len(palette)]) for i, r in enumerate(radii)]

# 生成器表达式 + zip：位置与物体并行推进
offsets = (0.42 * i for i in range(COUNT))
group = VGroup(*[c.move_to([x, 0, 0]) for c, x in zip(circles, offsets)])

# 字典 / 集合推导：算一条摘要（不画，只 print）
areas = {f"r{i}": round(math.pi * r * r, 2) for i, r in enumerate(radii)}
print("syntax-comprehensions", len(circles), round(sum(areas.values()), 3), len(set(radii)), sorted(areas)[:2])


class ComprehensionsScene(Scene):
    def construct(self):
        self.play(LaggedStart(*[Create(c) for c in group], lag_ratio=0.12))
        self.play(group.animate.shift(UP * 0.35).scale(1.05))
        self.wait(0.3)
