"""用 tracker 驱动位置

@expect tracker 的值被动画推进时，点跟着移到对应位置（print 出的坐标与画面一致）。"""

from manim import *


class ValueDrivenScene(Scene):
    def construct(self):
        tracker = ValueTracker(0)
        dot = Dot(color=RED)
        dot.add_updater(lambda m: m.move_to([tracker.get_value(), 0, 0]))
        self.add(tracker, dot)
        self.play(tracker.animate.set_value(2), run_time=1)
        self.wait(0.3)
