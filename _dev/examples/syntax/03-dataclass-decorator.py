"""语法综合：dataclass / 装饰器 / 类属性一起建图

@expect dataclass / 装饰器 / 类属性跑通，建出的图形与数据一致。
@note 用 dataclass 描述一批图元规格、装饰器做参数校验、classmethod 生成角度表、
      property 算面积——面向对象那一套语法跟 manim 混在一起的真实写法。
      校验失败那条走 raise，验证异常能穿到预检。
"""

from manim import *
from dataclasses import dataclass, field
import math


def validated(build):
    """装饰器：先校验半径为正，再建物。"""
    def wrapper(spec):
        if spec.radius <= 0:
            raise ValueError(f"半径必须为正：{spec.radius}")
        return build(spec)
    return wrapper


@dataclass
class Spec:
    radius: float
    color: str
    angles: list = field(default_factory=list)

    @property
    def area(self):
        return math.pi * self.radius ** 2

    @classmethod
    def fan(cls, count):
        """从原点辐射出 count 个方向。"""
        return [2 * math.pi * i / count for i in range(count)]


@validated
def build_ring(spec):
    pts = [[spec.radius * math.cos(a), spec.radius * math.sin(a), 0] for a in spec.angles]
    return VGroup(*[Dot(point=p, color=spec.color) for p in pts])


specs = [
    Spec(radius=0.6, color=BLUE, angles=Spec.fan(6)),
    Spec(radius=1.0, color=GREEN, angles=Spec.fan(6)),
    Spec(radius=1.4, color=YELLOW, angles=Spec.fan(6)),
]
rings = VGroup(*[build_ring(s) for s in specs])
print("syntax-dataclass", len(specs), len(specs[0].angles), round(sum(s.area for s in specs), 3), round(specs[0].area, 3))


class DataclassScene(Scene):
    def construct(self):
        self.play(FadeIn(rings))
        self.play(rings.animate.rotate(math.pi / 6))
        self.wait(0.3)
