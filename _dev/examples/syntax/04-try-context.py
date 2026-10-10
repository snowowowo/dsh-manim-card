"""语法综合：异常处理 / 上下文管理器 / 自定义异常

@expect 异常被接住、上下文管理器正常进出（print 断言为准），画面正常。
@note 真实代码里「构造失败要兜住」很常见——这里用自定义异常 + try/except/else/finally
      配 contextlib.contextmanager，把一批形状安全建出来，坏参数自动跳过。
      既验语法，也验「用户态异常不该把整段顶掉」。
"""

from manim import *
from contextlib import contextmanager


class ShapeError(Exception):
    """形状参数不合法。"""


@contextmanager
def tracked(label):
    """上下文管理器：进入时记账，退出时补一笔——用 yield 写一遍 try/finally 的味道。"""
    log = [label]
    try:
        yield log
    finally:
        log.append("done")


def safe_square(side):
    if side <= 0:
        raise ShapeError(f"边长必须为正：{side}")
    return Square(side_length=side)


sides = [1.6, 0.0, 1.1, -0.5, 0.8]
shapes = []
errors = []
for i, side in enumerate(sides):
    with tracked(f"sq{i}") as log:
        try:
            shapes.append(safe_square(side))
        except ShapeError as exc:
            errors.append(str(exc))
        else:
            log.append("ok")
        finally:
            log.append("checked")

group = VGroup(*[s.move_to([0.5 * i - 1.0, 0, 0]) for i, s in enumerate(shapes)])
print("syntax-errors", len(shapes), len(errors), errors[0])


class ErrorsScene(Scene):
    def construct(self):
        self.play(LaggedStart(*[FadeIn(s) for s in group], lag_ratio=0.15))
        self.wait(0.3)
