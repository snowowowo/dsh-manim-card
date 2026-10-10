"""二面体群 D4：正方形的 8 个对称（4 旋转 + 4 镜像）

@expect 上排 4 个正方形分别是转 0° / 90° / 180° / 270°，下排 4 个是沿竖轴、横轴、两条对角线的镜像；标记点 8 次落在 8 个互不相同的位置，说明这 8 个变换两两不等。
@note 讲解要点：D4 的大小不是 4 而是 8——除了旋转还必须数上镜像。正方形有 8 个对称，正 n 边形有 2n 个；这也解释了为什么「转一下」和「翻一下」在某些顺序下不能交换（非交换群的最小样本）。
"""

from manim import *
import math


class DihedralSymmetryScene(Scene):
    def construct(self):
        half = 0.62
        mark_home = [half, half * 0.3]
        xs_top = [-4.8, -1.6, 1.6, 4.8]
        xs_bot = [-4.8, -1.6, 1.6, 4.8]
        y_top = 1.2
        y_bot = -1.7

        def place(center, dx, dy, axis=None):
            square = Square(side_length=half * 2, color=BLUE).move_to(center)
            arm = Line(center, [center[0] + dx, center[1] + dy, 0], color=GRAY_A, stroke_width=2)
            mark = Dot([center[0] + dx, center[1] + dy, 0], radius=0.09, color=RED)
            group = VGroup(square, arm, mark)
            if axis == "v":
                group.add(DashedLine([center[0], center[1] - half, 0], [center[0], center[1] + half, 0], color=YELLOW))
            elif axis == "h":
                group.add(DashedLine([center[0] - half, center[1], 0], [center[0] + half, center[1], 0], color=YELLOW))
            elif axis == "d":
                group.add(
                    DashedLine([center[0] - half, center[1] - half, 0], [center[0] + half, center[1] + half, 0], color=YELLOW)
                )
            elif axis == "a":
                group.add(
                    DashedLine([center[0] - half, center[1] + half, 0], [center[0] + half, center[1] - half, 0], color=YELLOW)
                )
            return group

        rotations = VGroup()
        rot_names = VGroup()
        for idx, x in enumerate(xs_top):
            ang = idx * math.pi / 2
            dx = mark_home[0] * math.cos(ang) - mark_home[1] * math.sin(ang)
            dy = mark_home[0] * math.sin(ang) + mark_home[1] * math.cos(ang)
            rotations.add(place([x, y_top, 0], dx, dy))
            rot_names.add(Text(f"旋转 {idx * 90}°", font_size=22, color=GREEN).move_to([x, y_top + 1.15, 0]))

        reflections = VGroup()
        ref_names = VGroup()
        mx, my = mark_home
        # 反射后的标记坐标：竖轴 (-x, y)、横轴 (x, -y)、对角 y=x 取 (y, x)、反对角 y=-x 取 (-y, -x)
        specs = [("v", -mx, my, "竖轴镜像"), ("h", mx, -my, "横轴镜像"),
                 ("d", my, mx, "对角镜像"), ("a", -my, -mx, "反对角镜像")]
        for x, (axis, dx, dy, label) in zip(xs_bot, specs):
            reflections.add(place([x, y_bot, 0], dx, dy, axis=axis))
            ref_names.add(Text(label, font_size=22, color=YELLOW).move_to([x, y_bot - 1.15, 0]))

        formula = MathTex(r"|D_4| = 2 \times 4 = 8", font_size=46).move_to([0, 3.4, 0])
        caption = Text("正 n 边形有 2n 个对称：n 个旋转 + n 个镜像", font_size=25, color=GRAY_A)
        caption.move_to([0, 2.9, 0])

        self.play(Write(formula), Write(caption), run_time=0.8)
        self.play(LaggedStart(*[FadeIn(g) for g in rotations], lag_ratio=0.2), run_time=1.4)
        self.play(Write(rot_names), run_time=0.7)
        self.play(LaggedStart(*[FadeIn(g) for g in reflections], lag_ratio=0.2), run_time=1.4)
        self.play(Write(ref_names), run_time=0.7)
        self.wait(0.4)
