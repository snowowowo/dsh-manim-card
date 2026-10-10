"""ScaleInPlace 缩放

@expect 物体原地放大或缩小，中心不动。"""

from manim import *


class ScaleInPlaceScene(Scene):
    def construct(self):
        square = Square(side_length=2, color=BLUE)
        self.play(Create(square))
        self.play(ScaleInPlace(square, 0.5), run_time=1.5)
        self.wait(0.3)
