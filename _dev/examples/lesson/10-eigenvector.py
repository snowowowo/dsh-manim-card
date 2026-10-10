"""线性变换：特征方向

@expect 特征方向上的向量变换后仍在这条方向上（红 v₁ 沿虚线拉长 3 倍、蓝 v₂ 不动），
灰色对照向量 u 变换后偏离原方向——偏折的与不偏折的对照着看；虚线即两条特征方向。
变换前三根向量以半透明 ghost 留原位，箭头尖附近有 λ₁=3 / λ₂=1 标注。
@template 要讲线性变换 / 矩阵作用于图形与向量（网格变形、变换前后对照、找不变方向）时照它抄。
@note 讲解模板：变换后方向不变的向量就是特征向量（A 的特征值 3 与 1，特征方向 [1,1] 与 [1,-1]）
"""

from manim import *
import numpy as np


class EigenvectorScene(Scene):
    def construct(self):
        A = np.array([[2.0, 1.0], [1.0, 2.0]])

        # 两条特征方向虚线（[1,1] 与 [1,-1]）
        dash_e1 = DashedLine([-2.9, -2.9, 0], [2.9, 2.9, 0], color=GRAY_D, stroke_width=1.5)
        dash_e2 = DashedLine([-2.9, 2.9, 0], [2.9, -2.9, 0], color=GRAY_D, stroke_width=1.5)

        # 特征向量缩短初始长度，拉长 3 倍后仍不出框
        vec_a = Arrow(start=ORIGIN, end=[0.8, 0.8, 0], color=RED, buff=0)
        vec_b = Arrow(start=ORIGIN, end=[1.5, -1.5, 0], color=BLUE, buff=0)
        # 非特征对照向量，变换后明显偏折（[1,1] 方向的 v₁ 不偏，对照才醒目）
        vec_c = Arrow(start=ORIGIN, end=[1.4, 0.2, 0], color=GRAY_B, buff=0)

        t = ValueTracker(0)

        def tip(v):
            """从初始端点插值到 A·v 的端点，供标签跟随（不用 MathTex 包围盒定位）"""
            v = np.asarray(v, dtype=float)
            w = A @ v[:2]
            return (1 - t.get_value()) * v + t.get_value() * np.array([w[0], w[1], 0.0])

        label_a = MathTex(r"\vec v_1", color=RED, font_size=36)
        label_a.add_updater(lambda m: m.move_to(tip([0.8, 0.8, 0]) + UP * 0.25 + RIGHT * 0.35))
        label_b = MathTex(r"\vec v_2", color=BLUE, font_size=36)
        label_b.add_updater(lambda m: m.move_to(tip([1.5, -1.5, 0]) + DOWN * 0.05 + RIGHT * 0.4))
        label_c = MathTex(r"\vec u", color=GRAY_B, font_size=36)
        label_c.add_updater(lambda m: m.move_to(tip([1.4, 0.2, 0]) + DOWN * 0.35))

        title = MathTex(r"A = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}").move_to([0, 3.4, 0])

        self.play(FadeIn(dash_e1), FadeIn(dash_e2))
        self.play(Create(vec_a), Create(vec_b), Create(vec_c), Write(title))
        self.play(Write(label_a), Write(label_b), Write(label_c), run_time=0.6)

        # 变换前 ghost：三根向量以低透明度留原位（不参与变换），供 before/after 对照
        ghosts = VGroup(vec_a.copy(), vec_b.copy(), vec_c.copy()).set_opacity(0.25)
        self.play(FadeIn(ghosts), run_time=0.5)

        self.play(
            ApplyMatrix([[2, 1], [1, 2]], VGroup(vec_a, vec_b, vec_c)),
            t.animate.set_value(1),
            run_time=2,
        )
        # 特征值标注：单个 MathTex 直接 move_to 到对应箭头尖附近
        lam_1 = MathTex(r"\lambda_1=3", color=RED, font_size=40).move_to([3.0, 1.9, 0])
        lam_2 = MathTex(r"\lambda_2=1", color=BLUE, font_size=40).move_to([2.3, -2.1, 0])
        self.play(Write(lam_1), Write(lam_2), run_time=0.7)
        self.wait(0.3)
