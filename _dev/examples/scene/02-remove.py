"""remove 摘掉物体

@expect 被 remove 的物体消失，其余物体原样保留：场景放三个物体，
        只 remove 其中一个（红圆，标注「remove」），终帧蓝方块与黄三角
        仍在、红圆不在——「只删一个」自证。
"""

from manim import *


class RemoveScene(Scene):
    def construct(self):
        square = Square(side_length=1.6, color=BLUE)
        square.move_to([-3.5, 0, 0])
        circle = Circle(radius=0.9, color=RED)
        circle.move_to([0, 0, 0])
        triangle = Triangle(color=YELLOW)
        triangle.move_to([3.5, 0, 0])
        self.play(Create(square), Create(circle), Create(triangle))

        gone = Text("remove", font_size=24, color=RED)
        gone.move_to([0, 1.6, 0])
        stay = Text("保留", font_size=24, color=GREY_A)
        stay.move_to([-3.5, 1.6, 0])
        stay2 = Text("保留", font_size=24, color=GREY_A)
        stay2.move_to([3.5, 1.6, 0])
        self.play(FadeIn(gone), FadeIn(stay), FadeIn(stay2))

        # 只摘红圆一个，其余原样保留
        self.remove(circle)
        self.wait(0.3)
