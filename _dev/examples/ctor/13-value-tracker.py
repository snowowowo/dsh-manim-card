"""ValueTracker 收一个初值

@expect ValueTracker 不画任何东西（它只是数值），场景渲染不炸、其余物体正常。"""

from manim import *


class ValueTrackerScene(Scene):
    def construct(self):
        tracker = ValueTracker(0)
        dot = Dot(point=[-2, 0, 0], color=RED)
        dot.add_updater(lambda m: m.move_to([tracker.get_value() - 2, 0, 0]))
        self.add(tracker, dot)
        self.play(tracker.animate.set_value(4), run_time=1)
        self.wait(0.3)
