"""clear_updaters 停掉跟随

@expect clear_updaters 之后物体停住：tracker 再变它也不跟。"""

from manim import *


class ClearScene(Scene):
    def construct(self):
        tracker = ValueTracker(0)
        dot = Dot(color=RED)
        dot.add_updater(lambda m: m.move_to([tracker.get_value(), 0, 0]))
        self.add(tracker, dot)
        self.play(tracker.animate.set_value(2), run_time=1)
        dot.clear_updaters()
        self.play(tracker.animate.set_value(0), run_time=1)
        self.wait(0.3)
