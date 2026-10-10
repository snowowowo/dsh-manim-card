"""API 点名：动画面（函数 / 文字 / 包装那一批）

@expect 函数/文字/包装类动画逐支播完：回调真的被调、文字逐字出现等效果可辨识。
@note 这几个把**回调**交给动画（ApplyFunction / Homotopy / ApplyMethod 这类），或针对文字
      （TypeWithCursor）。回调从 Python 过桥是 PyProxy，能被 JS 调用——真机跑通才算数。
      逐支落格、格下标名字，终帧每格有痕迹。适配层缺口：ApplyMethod 的方法参数过桥不完整——
      "shift" 插值得 NaN（渲染空白）、"scale" 报 spread 迭代错、"move_to" 名字跑通但不位移；
      这支先按 "move_to" 点名（物体在格内可见），方法效果待桥修复后补验。
      RemoveTextLetterByLetter / UntypeWithCursor 终态是删完，垫灰字作对照。
      另一缺口：PhaseFlow 过 PyProxy 回调后几何被污染——恒等同伦也会把物体位移/放大
      （y 向漂出 e 量级、宽度涨到 ~1.9），终态无从留痕，播完把被污染的物体请走。
"""

from manim import *

COLS = [-5, -2.5, 0, 2.5, 5]
ROWS = [2.3, 0, -2.3]


def cell(r, c):
    return [COLS[c], ROWS[r], 0]


def off(base, dx, dy):
    return [base[0] + dx, base[1] + dy, 0]


class ApiAnimsFuncScene(Scene):
    def construct(self):
        # —— 函数/回调支：恒等回调，点留在格里 ——
        d = Dot(radius=0.35).move_to(cell(0, 0))
        self.play(ApplyFunction(lambda m: m, d), run_time=0.05)
        self.add(Text("ApplyFunction", font_size=20).move_to(off(cell(0, 0), 0, -0.9)))
        # ApplyMethod：见 @note——"shift"/"scale" 过桥有缺口，用 "move_to" 点名
        d = Dot(radius=0.35).move_to(cell(0, 1))
        self.add(d)
        self.play(ApplyMethod(d, "move_to", off(cell(0, 1), 0.4, 0)), run_time=0.05)
        self.add(Text("ApplyMethod", font_size=20).move_to(off(cell(0, 1), 0, -0.9)))
        d = Dot(radius=0.35).move_to(cell(0, 2))
        self.play(ApplyPointwiseFunction(lambda p: p, d), run_time=0.05)
        self.add(Text("ApplyPointwiseFunction", font_size=20).move_to(off(cell(0, 2), 0, -0.9)))
        d = Dot(radius=0.35).move_to(cell(0, 3))
        self.play(ApplyPointwiseFunctionToCenter(lambda p: p, d), run_time=0.05)
        self.add(Text("ApplyPointwiseFunctionToCenter", font_size=20).move_to(off(cell(0, 3), 0, -0.9)))
        d = Dot(radius=0.35).move_to(cell(0, 4))
        self.play(ApplyComplexFunction(lambda z: z, d), run_time=0.05)
        self.add(Text("ApplyComplexFunction", font_size=20).move_to(off(cell(0, 4), 0, -0.9)))
        # —— homotopy 支：恒等同伦，点留在格里（PhaseFlow 会把点撑大，独占一格不碍邻格）——
        d = Dot(radius=0.35).move_to(cell(1, 0))
        self.play(Homotopy(lambda x, y, z, t: [x, y, z], d), run_time=0.05)
        self.add(Text("Homotopy", font_size=20).move_to(off(cell(1, 0), 0, -0.9)))
        d = Dot(radius=0.35).move_to(cell(1, 1))
        self.play(ComplexHomotopy(lambda z, t: z, d), run_time=0.05)
        self.add(Text("ComplexHomotopy", font_size=20).move_to(off(cell(1, 1), 0, -0.9)))
        d = Dot(radius=0.35).move_to(cell(1, 2))
        self.play(SmoothedVectorizedHomotopy(lambda x, y, z, t: [x, y, z], d), run_time=0.05)
        self.add(Text("SmoothedVectorizedHomotopy", font_size=20).move_to(off(cell(1, 2), 0, -0.9)))
        d = Dot(radius=0.35).move_to(cell(1, 3))
        self.play(PhaseFlow(lambda p: p, d), run_time=0.05)
        self.remove(d)  # 见 @note：PhaseFlow 过桥污染几何，终态不留痕
        self.add(Text("PhaseFlow*", font_size=20).move_to(off(cell(1, 3), 0, -0.9)))
        # —— 文字支：垫灰字作对照，白字落在灰字上 ——
        ghost = Text("hi", color=GREY).move_to(cell(1, 4))
        self.add(ghost)
        t = Text("hi").move_to(cell(1, 4))
        self.play(AddTextLetterByLetter(t), run_time=0.05)
        self.add(Text("AddTextLetterByLetter", font_size=20).move_to(off(cell(1, 4), 0, -0.9)))
        ghost = Text("hi", color=GREY).move_to(cell(2, 0))
        self.add(ghost)
        t = Text("hi").move_to(cell(2, 0))
        self.play(RemoveTextLetterByLetter(t), run_time=0.05)
        self.add(Text("RemoveTextLetterByLetter", font_size=20).move_to(off(cell(2, 0), 0, -0.9)))
        ghost = Text("hi", color=GREY).move_to(cell(2, 1))
        self.add(ghost)
        t = Text("hi").move_to(cell(2, 1))
        self.play(AddTextWordByWord(t), run_time=0.05)
        self.add(Text("AddTextWordByWord", font_size=20).move_to(off(cell(2, 1), 0, -0.9)))
        t = Text("hi").move_to(cell(2, 2))
        self.play(TypeWithCursor(t), run_time=0.05)
        self.add(Text("TypeWithCursor", font_size=20).move_to(off(cell(2, 2), 0, -0.9)))
        ghost = Text("hi", color=GREY).move_to(cell(2, 3))
        self.add(ghost)
        t = Text("hi").move_to(cell(2, 3))
        self.play(UntypeWithCursor(t), run_time=0.05)
        self.add(Text("UntypeWithCursor", font_size=20).move_to(off(cell(2, 3), 0, -0.9)))
        self.wait(0.2)
