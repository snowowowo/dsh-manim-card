"""API 点名：动画面（函数 / 文字 / 包装那一批）

@expect 函数/文字/包装类动画逐支播完：回调真的被调、文字逐字出现等效果可辨识。
@note 这几个把**回调**交给动画（ApplyFunction / Homotopy / ApplyMethod 这类），或针对文字
      （TypeWithCursor）。回调从 Python 过桥是 PyProxy，能被 JS 调用——真机跑通才算数。
"""

from manim import *


class ApiAnimsFuncScene(Scene):
    def construct(self):
        self.play(ApplyFunction(lambda m: m, Dot(radius=0.3)), run_time=0.05)
        self.play(ApplyMethod(Dot(radius=0.3), "shift", UP), run_time=0.05)
        self.play(ApplyPointwiseFunction(lambda p: p, Dot(radius=0.3)), run_time=0.05)
        self.play(ApplyPointwiseFunctionToCenter(lambda p: p, Dot(radius=0.3)), run_time=0.05)
        self.play(ApplyComplexFunction(lambda z: z, Dot(radius=0.3)), run_time=0.05)
        self.play(Homotopy(lambda x, y, z, t: [x, y, z], Dot(radius=0.3)), run_time=0.05)
        self.play(ComplexHomotopy(lambda z, t: z, Dot(radius=0.3)), run_time=0.05)
        self.play(
            SmoothedVectorizedHomotopy(lambda x, y, z, t: [x, y, z], Dot(radius=0.3)),
            run_time=0.05,
        )
        self.play(PhaseFlow(lambda p: p, Dot(radius=0.3)), run_time=0.05)
        self.play(AddTextLetterByLetter(Text("hi")), run_time=0.05)
        self.play(RemoveTextLetterByLetter(Text("hi")), run_time=0.05)
        self.play(AddTextWordByWord(Text("hi")), run_time=0.05)
        self.play(TypeWithCursor(Text("hi")), run_time=0.05)
        self.play(UntypeWithCursor(Text("hi")), run_time=0.05)
        self.wait(0.2)
