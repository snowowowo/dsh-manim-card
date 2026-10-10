"""API 覆盖：颜色常量一览（全部 76 个可用色）

@expect 76 个方块按每行 10 个排成色板，每块用自己的名字上色（红黄蓝绿紫灰棕……各不相同）——不是一整片黑（黑 = 修过的 set_stroke 冲掉填充的事故）。
@note 这一组是「API 覆盖」的兜底网：三态表里 state=ok 的**颜色名**逐个上色。
      以前语料只用到十来个颜色，于是 `GREEN_A` / `GREY_BROWN` 这类名字写错（或桥没接上）
      要等某个用户随手写一次才暴露——这里一次性把整张调色板钉住。
      名字写在下面的清单里（不是循环拼出来的），这样「谁被覆盖了」在源码上就看得见。
"""

from manim import *

NAMES = [
    "BLACK", "BLUE", "BLUE_A", "BLUE_B", "BLUE_C", "BLUE_D", "BLUE_E",
    "DARKER_GRAY", "DARK_BLUE", "DARK_BROWN", "DARK_GRAY",
    "GOLD", "GOLD_A", "GOLD_B", "GOLD_C", "GOLD_D", "GOLD_E",
    "GRAY", "GRAY_A", "GRAY_B", "GRAY_C", "GRAY_D", "GRAY_E",
    "GREEN", "GREEN_A", "GREEN_B", "GREEN_C", "GREEN_D", "GREEN_E",
    "GREY", "GREY_A", "GREY_B", "GREY_BROWN", "GREY_C", "GREY_D", "GREY_E",
    "LIGHTER_GRAY", "LIGHT_BROWN", "LIGHT_GRAY", "LIGHT_PINK",
    "MAROON", "MAROON_A", "MAROON_B", "MAROON_C", "MAROON_D", "MAROON_E",
    "ORANGE", "PINK", "PURE_BLUE", "PURE_GREEN", "PURE_RED",
    "PURPLE", "PURPLE_A", "PURPLE_B", "PURPLE_C", "PURPLE_D", "PURPLE_E",
    "RED", "RED_A", "RED_B", "RED_C", "RED_D", "RED_E",
    "TEAL", "TEAL_A", "TEAL_B", "TEAL_C", "TEAL_D", "TEAL_E",
    "WHITE", "YELLOW", "YELLOW_A", "YELLOW_B", "YELLOW_C", "YELLOW_D", "YELLOW_E",
]

PER_ROW = 10
SWATCH = 0.38

# 名字 → 颜色值：`from manim import *` 把它们带进本模块的 globals
swatches = VGroup(*[
    Square(side_length=SWATCH)
    .set_fill(globals()[name], opacity=1.0)
    .set_stroke(width=0, color=BLACK)
    .move_to([
        (i % PER_ROW) * (SWATCH + 0.06) - (PER_ROW - 1) * (SWATCH + 0.06) / 2,
        (len(NAMES) // PER_ROW) / 2 * (SWATCH + 0.12) - (i // PER_ROW) * (SWATCH + 0.12),
        0,
    ])
    for i, name in enumerate(NAMES)
])
print("api-colors", len(NAMES), len(swatches))


class ApiColorsScene(Scene):
    def construct(self):
        self.play(LaggedStart(*[FadeIn(s) for s in swatches], lag_ratio=0.004))
        self.wait(0.3)
