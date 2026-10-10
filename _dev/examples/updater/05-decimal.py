"""数字跟着 tracker 变

@expect 数字实时跟着 tracker 变（不是播完才跳到终值）。"""

from manim import *


class DecimalScene(Scene):
    def construct(self):
        tracker = ValueTracker(0)
        num = DecimalNumber(0, num_decimal_places=1)
        num.to_corner(UR)
        num.add_updater(lambda m: m.set_value(tracker.get_value()))
        self.add(tracker, num)
        self.play(tracker.animate.set_value(5), run_time=1)
        self.wait(0.3)
