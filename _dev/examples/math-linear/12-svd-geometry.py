"""SVD 的几何含义：旋转 → 拉伸 → 再旋转

@expect 黄色圆经过三步（转 40°、沿轴拉伸、再转 -25°）变成一个倾斜的椭圆；
        中间那一步能明显看出两个方向被拉得不一样。
@note 讲解要点：任何矩阵都拆成「转一下、沿坐标轴拉一下、再转一下」——这就是 SVD。
    奇异值就是拉伸那两个倍数，左右两个旋转就是两套正交基的朝向。
"""

from manim import *
import math


class SvdGeometryScene(Scene):
    def construct(self):
        plane = NumberPlane(
            x_range=[-4, 4, 1],
            y_range=[-3, 3, 1],
            x_length=6.4,
            y_length=4.8,
            background_line_style={"stroke_color": GRAY_D, "stroke_width": 1},
        )
        disk = Circle(radius=1.1, color=YELLOW, stroke_width=3).set_fill(YELLOW, 0.3)
        figure = VGroup(plane, disk)

        theta1 = math.radians(40)
        v = [[math.cos(theta1), -math.sin(theta1)], [math.sin(theta1), math.cos(theta1)]]
        sigma = [[2.0, 0], [0, 0.55]]
        theta2 = math.radians(-25)
        u = [[math.cos(theta2), -math.sin(theta2)], [math.sin(theta2), math.cos(theta2)]]

        # \mathsf / \mathcal / \mathbb 一律别用：KaTeX 字体切换要动态加载，这里只会整段画成空
        caption = MathTex(r"A = U \Sigma V^{T}", font_size=46).move_to([0, 3.3, 0])
        # 混合说明逐行绝对定位在右侧留白区，不压图形
        step_1 = Text("① 旋转", font_size=28, color=BLUE).move_to([5.4, 1.6, 0])
        step_2 = Text("② 沿轴拉伸 2 与 0.55", font_size=28, color=GREEN).move_to([5.4, 0.8, 0])
        step_3 = Text("③ 再旋转", font_size=28, color=RED).move_to([5.4, 0.0, 0])

        # ghost 层：原始圆（白虚线）与中间态椭圆（黄虚线，主轴沿拉伸方向的 40° 朝向）
        ghost_circle = DashedVMobject(
            disk.copy().set_fill(opacity=0).set_stroke(WHITE, 2), num_dashes=48)
        ghost_mid = DashedVMobject(
            Ellipse(width=4.4, height=1.21, color=YELLOW, stroke_width=2)
            .set_fill(opacity=0)
            .rotate(theta1),
            num_dashes=48,
        )
        major_axis = Line(start=[-2.2 * math.cos(theta1), -2.2 * math.sin(theta1), 0],
                          end=[2.2 * math.cos(theta1), 2.2 * math.sin(theta1), 0],
                          stroke_color=WHITE, stroke_width=2)
        minor_axis = Line(start=[0.605 * math.cos(theta1 + math.pi / 2), 0.605 * math.sin(theta1 + math.pi / 2), 0],
                          end=[-0.605 * math.cos(theta1 + math.pi / 2), -0.605 * math.sin(theta1 + math.pi / 2), 0],
                          stroke_color=WHITE, stroke_width=2)
        # MathTex 定位一律 move_to 绝对坐标
        sigma_major = MathTex("2", font_size=34, color=WHITE).move_to([2.05, 1.85, 0])
        sigma_minor = MathTex("0.55", font_size=34, color=WHITE).move_to([-0.95, 1.05, 0])

        self.play(Create(plane), FadeIn(disk), Write(caption), run_time=1.0)
        self.play(Write(step_1), run_time=0.4)
        self.play(ApplyMatrix(v, figure), run_time=1.2)
        self.play(Write(step_2), run_time=0.4)
        self.play(ApplyMatrix(sigma, figure), run_time=1.2)
        self.play(FadeIn(ghost_mid), Write(step_3), run_time=0.6)
        self.play(ApplyMatrix(u, figure), run_time=1.2)
        self.play(FadeIn(ghost_circle), Create(major_axis), Create(minor_axis),
                  Write(sigma_major), Write(sigma_minor), run_time=0.8)
        self.wait(0.4)
