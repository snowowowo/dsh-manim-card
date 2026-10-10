"""椭圆与圆环

@expect 一个椭圆与一个圆环：环是中空的（内外两个半径）。"""

from manim import *


class EllipseAnnulusScene(Scene):
    def construct(self):
        ellipse = Ellipse(width=4, height=2, color=TEAL)
        ellipse.shift(UP * 1.6)
        ring = Annulus(inner_radius=1, outer_radius=1.5, color=GREEN, fill_opacity=0.5)
        ring.shift(DOWN * 1.8)
        self.play(Create(ellipse), Create(ring))
        self.wait(0.3)
