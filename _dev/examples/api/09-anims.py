"""API 点名：动画面（表里 ok、语料未用到的那一批）

@expect 动画面逐支播完：每支动画都有可辨识的效果、不炸、不卡死渲染循环。
@note 三态表里 kind=anim、state=ok 的名字点一遍。动画的名字与「要几个目标、收什么参数」
      差别很大（Transform 两个、Rotate 带角度、CyclicReplace 收一个列表），所以一条一条写出来，
      靠真桥跑通钉住——写错名字或形状会当场报错。
"""

from manim import *


class ApiAnimsScene(Scene):
    def construct(self):
        self.play(Blink(Dot(radius=0.3)), run_time=0.05)
        self.play(Broadcast(Dot(radius=0.3)), run_time=0.05)
        self.play(FadeToColor(Dot(radius=0.3), RED), run_time=0.05)
        self.play(FocusOn(Dot(radius=0.3)), run_time=0.05)
        self.play(GrowFromPoint(Dot(radius=0.3), ORIGIN), run_time=0.05)
        self.play(ShowPassingFlash(Circle(radius=0.3)), run_time=0.05)
        self.play(ShowPassingFlashWithThinningStrokeWidth(Circle(radius=0.3)), run_time=0.05)
        self.play(ShowIncreasingSubsets(VGroup(Dot(), Dot())), run_time=0.05)
        self.play(ShowSubmobjectsOneByOne(VGroup(Dot(), Dot())), run_time=0.05)
        self.play(ShrinkToCenter(Dot(radius=0.3)), run_time=0.05)
        self.play(SpinInFromNothing(Dot(radius=0.3)), run_time=0.05)
        self.play(SpiralIn(Dot(radius=0.3)), run_time=0.05)
        self.play(Uncreate(Circle(radius=0.3)), run_time=0.05)
        self.play(Wiggle(Dot(radius=0.3)), run_time=0.05)
        self.play(Add(Dot(radius=0.3)), run_time=0.05)
        self.play(ApplyWave(Dot(radius=0.3)), run_time=0.05)
        self.play(ClockwiseTransform(Dot(), Square()), run_time=0.05)
        self.play(CounterclockwiseTransform(Dot(), Square()), run_time=0.05)
        self.play(CyclicReplace(Dot(), Square(), Triangle()), run_time=0.05)
        self.play(Swap(Dot(), Square()), run_time=0.05)
        self.play(Rotate(Dot(), PI / 2), run_time=0.05)
        self.play(TransformFromCopy(Dot(), Square()), run_time=0.05)
        self.play(TransformMatchingShapes(Dot(), Square()), run_time=0.05)
        self.play(FadeTransformPieces(Dot(), Square()), run_time=0.05)
        self.play(Succession(Create(Dot()), FadeOut(Dot())), run_time=0.05)
        self.play(Unwrite(Text("hi")), run_time=0.05)
        self.wait(0.2)
