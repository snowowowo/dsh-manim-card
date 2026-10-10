"""复平面与极坐标网格：整幅画布就是它们的画布

@expect 先是一幅复平面铺满画布，单位圆方向上标出一个 60° 的黄点并注明 e^{iπ/3}；随后整幅淡出，换成极坐标网格（同心圆 + 放射线），同一个方向再标一次。
@note 这两个类的背景网格在 manim-web 0.3.24 里不受 x_length / radius_max 约束——
      ComplexPlane 的网格永远铺满画布（x_range 只管刻度），PolarPlane 只认 size 不认 radius_max。
      所以它们没法缩成小图塞进点名网格，单独成条、整幅展示。
      也别想着 .scale() 缩它：manim-web 的 scale 无条件量包围盒（显式 about_point 也拦不住），
      无 WebGL 的回归环境直接炸 getBounds。
"""

from manim import *


class PlanesScene(Scene):
    def construct(self):
        plane = ComplexPlane(x_range=[-4.2, 4.2, 1], y_range=[-2.4, 2.4, 1])
        # e^{iπ/3} = cos60° + i·sin60°，取半径 1.5 画在单位方向上
        marker = Dot([1.5 * 0.5, 1.5 * 0.866, 0], radius=0.08, color=YELLOW)
        spoke = Line([0, 0, 0], [1.5 * 0.5, 1.5 * 0.866, 0], color=YELLOW, stroke_width=2.5)
        label = MathTex(r"e^{i\pi/3}", font_size=34, color=YELLOW).move_to([1.9, 1.6, 0])

        self.play(Create(plane), run_time=1.0)
        self.play(Create(spoke), FadeIn(marker), Write(label), run_time=0.7)
        self.wait(0.4)
        self.play(FadeOut(plane), FadeOut(spoke), FadeOut(marker), FadeOut(label), run_time=0.8)

        polar = PolarPlane(size=6.2)
        marker2 = Dot([1.5 * 0.5, 1.5 * 0.866, 0], radius=0.08, color=YELLOW)
        spoke2 = Line([0, 0, 0], [1.5 * 0.5, 1.5 * 0.866, 0], color=YELLOW, stroke_width=2.5)
        label2 = Text("同一个方向：60°", font_size=26, color=YELLOW).move_to([2.7, 2.2, 0])

        self.play(Create(polar), run_time=1.0)
        self.play(Create(spoke2), FadeIn(marker2), Write(label2), run_time=0.7)
        self.wait(0.4)
