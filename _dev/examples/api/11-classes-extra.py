"""API 点名：形状 / 标记 / 图 / 3D（表里 ok、语料此前没点到的那一批）

@expect 网格布局：每个被点名的类占一格、格下有名字标签，依赖簇（弧+弧括号、方块+括号）成组摆放，
        互不遮挡、全部在画布内。
@note 这些类 manim-web 都有，只是构造姿势与 CE 不同（CE 收位置参数、manim-web 多收一个选项对象）——
      在 surface.ts 的 CTOR 里逐个登记了配方。全部对象默认叠在原点，必须逐格摆放；
      MathTex 一支只敢用 move_to 定位。
"""

from manim import *

COLS = [-5.5, -3.3, -1.1, 1.1, 3.3, 5.5]
ROWS = [3.0, 1.7, 0.4, -0.9, -2.2]


def cell(r, c, dy=0.15):
    return [COLS[c], ROWS[r] + dy, 0]


def label_at(r, c, text, dy=-0.42):
    return Text(text, font_size=11).move_to([COLS[c], ROWS[r] + dy, 0])


class ExtraClassesScene(Scene):
    def construct(self):
        # —— 行 0：切线 / 切弧 / 多角星；两个括号簇挪到最底行（下方留白，垂下来的括号不压人）——
        arc = Arc(radius=0.7, start_angle=0, angle=PI / 2).move_to(cell(0, 0, 0.3))
        self.add(label_at(0, 0, "ArcBrace"), ArcBrace(arc), arc)

        tline = TangentLine(Circle(radius=1), 0.25).scale(0.45).move_to(cell(0, 1))
        self.add(label_at(0, 1, "TangentLine"), tline)

        tarc = TangentialArc(ORIGIN, RIGHT, radius=1, angle=PI / 3).scale(0.8).move_to(cell(0, 2))
        self.add(label_at(0, 2, "TangentialArc"), tarc)

        polygram7 = RegularPolygram(7, density=3).scale(0.55).move_to(cell(0, 3))
        self.add(label_at(0, 3, "RegularPolygram"), polygram7)

        # —— 行 1：凸包 / 多角形 / 带标签的线箭头点 ——
        hull = ConvexHull([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0.2, 0.8, 0]]).scale(0.8).move_to(cell(1, 0))
        self.add(label_at(1, 0, "ConvexHull"), hull)

        pg = Polygram([[[0, 0, 0], [1, 0, 0], [0.5, 0.9, 0]]]).scale(0.8).move_to(cell(1, 1))
        self.add(label_at(1, 1, "Polygram"), pg)

        lline = LabeledLine(start=LEFT, end=RIGHT, label="l").scale(0.7).move_to(cell(1, 2))
        self.add(label_at(1, 2, "LabeledLine"), lline)

        larrow = LabeledArrow(start=LEFT, end=RIGHT, label="a").scale(0.7).move_to(cell(1, 3))
        self.add(label_at(1, 3, "LabeledArrow"), larrow)

        ldot = LabeledDot(point=ORIGIN, label="d").move_to(cell(1, 4))
        self.add(label_at(1, 4, "LabeledDot"), ldot)

        lpg = LabeledPolygram(vertex_groups=[[[0, 0, 0], [1, 0, 0], [0.5, 0.9, 0]]], label="p")
        lpg.scale(0.8).move_to(cell(1, 5))
        self.add(label_at(1, 5, "LabeledPolygram"), lpg)

        # —— 行 2：SVG 路径 / 图 / 样本空间 / 变量 / 代码块 ——
        svgp = VMobjectFromSVGPath(path_data="M0,0 L1,0 L1,1 Z").scale(1.2).move_to(cell(2, 0))
        self.add(label_at(2, 0, "VMobjectFromSVGPath"), svgp)

        graph = Graph(vertices=[1, 2, 3], edges=[(1, 2), (2, 3), (3, 1)]).scale(0.4).move_to(cell(2, 1))
        self.add(label_at(2, 1, "Graph"), graph)

        digraph = DiGraph(vertices=[1, 2, 3], edges=[(1, 2), (2, 3)]).scale(0.4).move_to(cell(2, 2))
        self.add(label_at(2, 2, "DiGraph"), digraph)

        space = SampleSpace(width=4, height=3).scale(0.32).move_to(cell(2, 3))
        space.set_stroke(WHITE, 1)  # 内圈椭圆默认黑填充，加白描边才看得见结构
        self.add(label_at(2, 3, "SampleSpace"), space)

        var = Variable(label="t", value=1).scale(0.8).move_to(cell(2, 4))
        self.add(label_at(2, 4, "Variable"), var)

        code = Code(code="x = 1", language="python").scale(1.0).move_to(cell(2, 5))
        self.add(label_at(2, 5, "Code"), code)

        # —— 行 3：点组 / 名字表 / 公式 / 向量场三兄弟 ——
        # PGroup（点云类）在桥上不渲染，已删并由主线处理。

        vd = VDict({"a": Dot().shift(LEFT * 0.35), "b": Square(side_length=0.5).shift(RIGHT * 0.35)})
        vd.move_to(cell(3, 1))
        self.add(label_at(3, 1, "VDict"), vd)

        smtex = SingleStringMathTex("x^2 + y^2").move_to(cell(3, 2))  # MathTex 只用 move_to 定位
        self.add(label_at(3, 2, "SingleStringMathTex"), smtex)

        def cell_field(cx, cy):
            # 方向场绕格心旋、幅度压到 0.4——箭头长度随场幅走，不压就伸出格子
            return lambda p: [-(p[1] - cy) * 0.4, (p[0] - cx) * 0.4, 0]

        cx, cy = COLS[3], ROWS[3]
        vfield = VectorField(
            cell_field(cx, cy), x_range=[cx - 1, cx + 1, 1], y_range=[cy - 0.35, cy + 0.75, 1],
        )
        self.add(label_at(3, 3, "VectorField", -0.32), vfield)

        ax, ay = COLS[4], ROWS[3]
        afield = ArrowVectorField(
            cell_field(ax, ay), x_range=[ax - 1, ax + 1, 1], y_range=[ay - 0.35, ay + 0.75, 1],
            length_func=lambda norm: min(norm, 0.25),  # 箭头默认太长，会伸出格子
        )
        self.add(label_at(3, 4, "ArrowVectorField", -0.32), afield)

        sx, sy = COLS[5], ROWS[3]
        stream = StreamLines(
            cell_field(sx, sy), x_range=[sx - 1, sx + 1, 1], y_range=[sy - 0.35, sy + 0.75, 1],
            num_lines=4,
        )
        self.add(label_at(3, 5, "StreamLines", -1.15), stream)

        # —— 行 4：3D 三件套 + 两个括号簇（底行下方留白）——
        l3 = Line3D(ORIGIN, UP).scale(1.1).move_to(cell(4, 0))
        self.add(label_at(4, 0, "Line3D"), l3)

        a3 = Arrow3D(ORIGIN, UP).scale(1.1).move_to(cell(4, 1))
        self.add(label_at(4, 1, "Arrow3D"), a3)

        hull3 = ConvexHull3D([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]]).scale(0.9).move_to(cell(4, 2))
        self.add(label_at(4, 2, "ConvexHull3D"), hull3)

        sq1 = Square(side_length=0.8).move_to(cell(4, 3, 0.1))
        # 名签放方块上方：括号+文字在方块下垂 ~0.8，下方是 "a"/"b" 的位置
        self.add(label_at(4, 3, "BraceLabel", 0.72), BraceLabel(sq1, "a"), sq1)

        sq2 = Square(side_length=0.8).move_to(cell(4, 4, 0.1))
        self.add(label_at(4, 4, "BraceText", 0.72), BraceText(sq2, "b"), sq2)

        self.wait(0.2)
