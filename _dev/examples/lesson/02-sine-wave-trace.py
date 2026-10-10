"""从圆上一点画出正弦波

@expect 圆上的点一边转、波形一边向右展开，画出的正是正弦曲线。
@note 讲解模板：ValueTracker 驱动圆上的点，TracedPath 把它的高度扫成波形
"""

from manim import *
import numpy as np


class SineWaveScene(Scene):
    def construct(self):
        radius = 1.2
        circle = Circle(radius=radius, color=BLUE).shift(LEFT * 3.5)
        dot = Dot(radius=0.08, color=YELLOW)
        pen = Dot(radius=0.001)
        wave = TracedPath(pen, stroke_color=YELLOW)
        tracker = ValueTracker(0)

        def follow(mob):
            angle = tracker.get_value()
            dot.move_to([-3.5 + radius * np.cos(angle), radius * np.sin(angle), 0])
            pen.move_to([0.5 + angle * 0.45, radius * np.sin(angle), 0])

        dot.add_updater(follow)
        pen.add_updater(follow)
        self.add(circle, wave, dot, pen)
        self.play(tracker.animate.set_value(TAU), run_time=3)
        self.wait(0.3)
