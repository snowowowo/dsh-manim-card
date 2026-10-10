"""蒙特卡洛估算 π：往正方形里撒点，数落在四分之一圆内的比例

@expect 边长为 2 的正方形内含一个四分之一圆，蓝点在正方形里随机撒开：落在圆弧内的染黄、在外面的留蓝；右下角实时显示累计比例乘 4 逼近 3.14。
@note 讲解要点：P(落在圆内) = 圆面积/正方形面积 = π/4，所以 π ≈ 4 × 命中比例。随机模拟的误差按 1/√n 收缩，想把精度翻倍就得撒四倍的点。
"""

from manim import *
import numpy as np


class MonteCarloPiScene(Scene):
    def construct(self):
        rng = np.random.default_rng(1024)
        radius = 2.4
        # 圆心（四分之一圆的圆心在正方形左下角）
        cx, cy = -3.9, -0.5
        x0, y0 = cx + radius, cy + radius

        square = Rectangle(width=2 * radius, height=2 * radius, color=GRAY_B)
        square.move_to([cx, cy, 0])
        # 四分之一圆的半径 = 正方形边长（圆心在左下角，弧端点落在另外两个角上）。
        # Arc 以圆心为原点生成，shift 直接把圆心放到左下角——不能用 move_to（那挪的是外接框中心）
        arc = Arc(radius=2 * radius, start_angle=0, angle=PI / 2, color=GREEN, stroke_width=4)
        arc.shift([cx - radius, cy - radius, 0])

        side_label = Text("边长 2", font_size=22, color=GRAY_A).move_to([cx, cy - radius - 0.35, 0])
        # 标签沿弧的 45° 方向放在弧内，别压在点堆里
        arc_label = Text("半径 2", font_size=22, color=GREEN).move_to(
            [cx - radius + 1.45, cy - radius + 1.45, 0]
        )

        pts = rng.random((1200, 2))
        hits = VGroup()
        misses = VGroup()
        for u, v in pts:
            x = cx - radius + float(u) * 2 * radius
            y = cy - radius + float(v) * 2 * radius
            if u * u + v * v <= 1.0:
                hits.add(Dot([x, y, 0], radius=0.03, color=YELLOW))
            else:
                misses.add(Dot([x, y, 0], radius=0.03, color=BLUE))

        ratio = len(hits) / len(pts)
        estimate = 4.0 * ratio

        formula = MathTex(
            r"\pi \approx 4 \times \frac{N_{\text{in}}}{N_{\text{all}}}",
            font_size=54,
        ).move_to([3.1, 1.6, 0])

        result = Text(f"命中 {len(hits)} / {len(pts)} → π ≈ {estimate:.3f}", font_size=34, color=YELLOW)
        result.move_to([3.1, 0.3, 0])
        truth = Text("真值 π = 3.14159...", font_size=26, color=GRAY_A).move_to([3.1, -0.5, 0])

        error_note = Text("误差按 1/√n 收缩：精度翻倍要点数 ×4", font_size=26, color=GRAY_A)
        error_note.move_to([3.1, -1.7, 0])

        title = Text("蒙特卡洛方法：用随机撒点量出面积比", font_size=30).to_edge(UP, buff=0.3)

        self.play(Write(title), run_time=0.7)
        self.play(Create(square), Create(arc), Write(side_label), Write(arc_label), run_time=0.9)
        self.play(LaggedStart(*[FadeIn(d) for d in hits], lag_ratio=0.01), run_time=1.6)
        self.play(FadeIn(misses), run_time=0.8)
        self.play(Write(formula), run_time=0.8)
        self.play(Write(result), Write(truth), run_time=0.8)
        self.play(Write(error_note), run_time=0.7)
        self.wait(0.4)
