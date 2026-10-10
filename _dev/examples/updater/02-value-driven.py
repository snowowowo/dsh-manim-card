"""用 tracker 驱动位置

@expect tracker 的值被动画推进时，点跟着移到对应位置（print 出的坐标与画面一致）。
自证：底部 NumberLine 的刻度 2 与红点落定位置重合。"""

from manim import *


class ValueDrivenScene(Scene):
    def construct(self):
        tracker = ValueTracker(0)
        dot = Dot(color=RED)
        dot.add_updater(lambda m: m.move_to([tracker.get_value(), 0, 0]))
        # length=8：8 个单位格对应 8 个场景单位，数轴 1:1，刻度 2 就在场景 x=2
        line = NumberLine(x_range=[-4, 4, 1], include_numbers=True, length=8)
        label = Text("tracker = 2", font_size=24)
        self.add(tracker, dot, line)
        self.play(tracker.animate.set_value(2), run_time=1)
        self.wait(0.3)
        # 等 updater flush 后点已落在 (2,0)，label 才跟着点走
        label.next_to(dot, UP)
        self.play(FadeIn(label))
        self.wait(0.3)
