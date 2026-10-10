"""用动画驱动更新函数（UpdateFromFunc / UpdateFromAlphaFunc）

@expect 更新函数在动画期间被驱动，回调里拿到的 m 能用 CE 方法名操作（修过的包装事故）。
@note 回调里的第一个参数是真 Mobject（适配层包过），CE 方法名照写即可：
      `lambda m: m.set_opacity(...)`。
      踩过的坑：这两个动画在 manim-web 里按回调(mobject, alpha) 调，而那个 mobject 是它自己的
      裸 JS 对象（只有 camelCase 方法）——不包一层就是 AttributeError，且抛在渲染循环里，
      播放的 promise 永不 resolve，页面一直转（真机事故）。适配层已在 _FUNC_ANIMATIONS 里包好。
      回调参数个数按自己的签名算：UpdateFromFunc 习惯写单参，写双参也能收下 alpha。
"""

from manim import *


class UpdateFromFuncScene(Scene):
    def construct(self):
        square = Square(side_length=2, color=BLUE)
        self.add(square)

        # 单参回调：整段动画期间反复调用（UpdateFromFunc 的 alpha 一般用不上）
        self.play(
            UpdateFromFunc(square, lambda m: m.set_stroke(color=YELLOW, width=8)),
            run_time=0.6,
        )

        # 双参回调：alpha 从 0 走到 1，适合「随进度改某个属性」
        self.play(
            UpdateFromAlphaFunc(square, lambda m, alpha: m.set_fill(BLUE, alpha)),
            run_time=0.8,
        )
        self.wait(0.3)
