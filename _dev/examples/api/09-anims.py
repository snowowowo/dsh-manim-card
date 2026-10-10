"""API 点名：动画面（表里 ok、语料未用到的那一批）

@expect 动画面逐支播完：每支动画都有可辨识的效果、不炸、不卡死渲染循环。
@note 三态表里 kind=anim、state=ok 的名字点一遍。动画的名字与「要几个目标、收什么参数」
      差别很大（Transform 两个、Rotate 带角度、CyclicReplace 收一个列表），所以一条一条写出来，
      靠真桥跑通钉住——写错名字或形状会当场报错。
      留痕支（播完在场景里留下可辨识终态的）排进网格位，格下标名字；纯过程支
      （Blink / Broadcast / FocusOn / ShowPassingFlash / ShowPassingFlashWithThinningStrokeWidth /
      ShrinkToCenter / Uncreate / Wiggle / ApplyWave / Succession / Unwrite）不留终态、
      静态终帧无从核对，照播但播完把被 play 收养回场景的目标请走——要观察过程得 --realtime 跑。
"""

from manim import *

COLS = [-5, -2.5, 0, 2.5, 5]
ROWS = [2.3, 0, -2.3]


def cell(r, c):
    return [COLS[c], ROWS[r], 0]


def off(base, dx, dy):
    return [base[0] + dx, base[1] + dy, 0]


class ApiAnimsScene(Scene):
    def construct(self):
        # —— 留痕支：先落格再播，终帧每格有痕迹 ——
        # FadeToColor：换色的点留在格里
        d = Dot(radius=0.35).move_to(cell(0, 0))
        self.play(FadeToColor(d, RED), run_time=0.05)
        self.add(Text("FadeToColor", font_size=20).move_to(off(cell(0, 0), 0, -0.9)))
        # GrowFromPoint：从原点长到位
        d = Dot(radius=0.35).move_to(cell(0, 1))
        self.play(GrowFromPoint(d, ORIGIN), run_time=0.05)
        self.add(Text("GrowFromPoint", font_size=20).move_to(off(cell(0, 1), 0, -0.9)))
        # ShowIncreasingSubsets：逐个亮出，终态是两个点都在
        g = VGroup(Dot().move_to(off(cell(0, 2), -0.35, 0)), Dot().move_to(off(cell(0, 2), 0.35, 0)))
        self.play(ShowIncreasingSubsets(g), run_time=0.05)
        self.add(Text("ShowIncreasingSubsets", font_size=20).move_to(off(cell(0, 2), 0, -0.9)))
        # ShowSubmobjectsOneByOne：逐个子物体亮出
        g = VGroup(Dot().move_to(off(cell(0, 3), -0.35, 0)), Dot().move_to(off(cell(0, 3), 0.35, 0)))
        self.play(ShowSubmobjectsOneByOne(g), run_time=0.05)
        self.add(Text("ShowSubmobjectsOneByOne", font_size=20).move_to(off(cell(0, 3), 0, -0.9)))
        # SpinInFromNothing：旋着进场，落在格里
        d = Dot(radius=0.35).move_to(cell(0, 4))
        self.play(SpinInFromNothing(d), run_time=0.05)
        self.add(Text("SpinInFromNothing", font_size=20).move_to(off(cell(0, 4), 0, -0.9)))
        # SpiralIn：螺旋进场
        d = Dot(radius=0.35).move_to(cell(1, 0))
        self.play(SpiralIn(d), run_time=0.05)
        self.add(Text("SpiralIn", font_size=20).move_to(off(cell(1, 0), 0, -0.9)))
        # Add：直接加进场景
        d = Dot(radius=0.35).move_to(cell(1, 1))
        self.play(Add(d), run_time=0.05)
        self.add(Text("Add", font_size=20).move_to(off(cell(1, 1), 0, -0.9)))
        # ClockwiseTransform：点变方，终态是方
        d = Dot(radius=0.3).move_to(cell(1, 2))
        sq = Square(side_length=0.7).move_to(cell(1, 2))
        self.play(ClockwiseTransform(d, sq), run_time=0.05)
        self.add(Text("ClockwiseTransform", font_size=20).move_to(off(cell(1, 2), 0, -0.9)))
        # CounterclockwiseTransform：同上反向
        d = Dot(radius=0.3).move_to(cell(1, 3))
        sq = Square(side_length=0.7).move_to(cell(1, 3))
        self.play(CounterclockwiseTransform(d, sq), run_time=0.05)
        self.add(Text("CounterclockwiseTransform", font_size=20).move_to(off(cell(1, 3), 0, -0.9)))
        # Swap：两个物体换位，终态两物体都在。
        # 桥的 play 只收养动画主目标，多目标动画（Swap / CyclicReplace）其余目标要预 add 进场景
        a = Dot(radius=0.3).move_to(off(cell(1, 4), -0.7, 0))
        b = Square(side_length=0.5).move_to(off(cell(1, 4), 0.7, 0))
        self.add(a, b)
        self.play(Swap(a, b), run_time=0.05)
        self.add(Text("Swap", font_size=20).move_to(off(cell(1, 4), 0, -0.9)))
        # CyclicReplace：三个物体轮换位置（多目标，同上预 add）
        a = Dot(radius=0.22).move_to(off(cell(2, 0), -0.7, 0))
        b = Square(side_length=0.4).move_to(cell(2, 0))
        c = Triangle().move_to(off(cell(2, 0), 0.7, 0))
        self.add(a, b, c)
        self.play(CyclicReplace(a, b, c), run_time=0.05)
        self.add(Text("CyclicReplace", font_size=20).move_to(off(cell(2, 0), 0, -0.9)))
        # Rotate：三角转 45°，终态是转过的三角
        t = Triangle().move_to(cell(2, 1)).scale(0.6)
        self.play(Rotate(t, PI / 4), run_time=0.05)
        self.add(Text("Rotate", font_size=20).move_to(off(cell(2, 1), 0, -0.9)))
        # TransformFromCopy：复制源点变方（源的副本落格，源本体预 add 留在旁作对照）
        d = Dot(radius=0.3).move_to(off(cell(2, 2), -0.8, 0))
        sq = Square(side_length=0.7).move_to(off(cell(2, 2), 0.5, 0))
        self.add(d)
        self.play(TransformFromCopy(d, sq), run_time=0.05)
        self.add(Text("TransformFromCopy", font_size=20).move_to(off(cell(2, 2), 0, -0.9)))
        # TransformMatchingShapes：点变方
        d = Dot(radius=0.3).move_to(cell(2, 3))
        sq = Square(side_length=0.7).move_to(cell(2, 3))
        self.play(TransformMatchingShapes(d, sq), run_time=0.05)
        self.add(Text("TransformMatchingShapes", font_size=20).move_to(off(cell(2, 3), 0, -0.9)))
        # FadeTransformPieces：淡入淡出换件
        d = Dot(radius=0.3).move_to(cell(2, 4))
        sq = Square(side_length=0.7).move_to(cell(2, 4))
        self.play(FadeTransformPieces(d, sq), run_time=0.05)
        self.add(Text("FadeTransformPieces", font_size=20).move_to(off(cell(2, 4), 0, -0.9)))

        # —— 纯过程支：照播钉住「名字能用」，播完把被收养回场景的目标请走（见 @note）——
        d = Dot(radius=0.3)
        self.play(Blink(d), run_time=0.05)
        self.remove(d)
        d = Dot(radius=0.3)
        self.play(Broadcast(d), run_time=0.05)
        self.remove(d)
        d = Dot(radius=0.3)
        self.play(FocusOn(d), run_time=0.05)
        self.remove(d)
        c = Circle(radius=0.3)
        self.play(ShowPassingFlash(c), run_time=0.05)
        self.remove(c)
        c = Circle(radius=0.3)
        self.play(ShowPassingFlashWithThinningStrokeWidth(c), run_time=0.05)
        self.remove(c)
        d = Dot(radius=0.3)
        self.play(ShrinkToCenter(d), run_time=0.05)
        self.remove(d)
        c = Circle(radius=0.3)
        self.play(Uncreate(c), run_time=0.05)
        self.remove(c)
        d = Dot(radius=0.3)
        self.play(Wiggle(d), run_time=0.05)
        self.remove(d)
        sq = Square(side_length=0.7)
        self.play(ApplyWave(sq), run_time=0.05)
        self.remove(sq)
        d = Dot(radius=0.3)
        self.play(Succession(Create(d), FadeOut(d)), run_time=0.05)
        self.remove(d)
        t = Text("hi")
        self.play(Unwrite(t), run_time=0.05)
        self.remove(t)
        self.wait(0.2)
