"""API 点名：形状 / 标记 / 图 / 3D（表里 ok、语料此前没点到的那一批）

@expect 一批此前没点到的类各画一个：弧括号、带标签的括号、切线、切弧、正多角星、凸包、SVG、图、样本空间、变量、代码块。
@note 这些类 manim-web 都有，只是构造姿势与 CE 不同（CE 收位置参数、manim-web 多收一个选项对象）——
      在 surface.ts 的 CTOR 里逐个登记了配方。这是第五轮「把覆盖率推向 100%」的一部分。
"""

from manim import *


class ExtraClassesScene(Scene):
    def construct(self):
        # 括住一个物体的三类：弧括号 / 带标签的括号 / 带文字的括号
        arc = Arc(radius=2, start_angle=0, angle=PI / 2)
        self.add(ArcBrace(arc))
        self.add(BraceLabel(Square(side_length=1), "a"))
        self.add(BraceText(Square(side_length=1), "b"))

        # 切线 / 切弧
        self.add(TangentLine(Circle(radius=1), 0.25))
        self.add(TangentialArc(ORIGIN, RIGHT, radius=1, angle=PI / 3))

        # 正多角星（7 个顶点、每步跨 3）与凸包、多角形
        self.add(RegularPolygram(7, density=3))
        self.add(ConvexHull([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0.2, 0.8, 0]]))
        self.add(Polygram([[[0, 0, 0], [1, 0, 0], [0.5, 0.9, 0]]]))

        # 带标签的线 / 箭头 / 点
        self.add(LabeledLine(start=LEFT, end=RIGHT, label="l"))
        self.add(LabeledArrow(start=LEFT, end=RIGHT, label="a"))
        self.add(LabeledDot(point=ORIGIN, label="d"))
        self.add(LabeledPolygram(vertex_groups=[[[0, 0, 0], [1, 0, 0], [0.5, 0.9, 0]]], label="p"))

        # 单条 SVG 路径（不需要外部文件，也不需要 DOM）
        self.add(VMobjectFromSVGPath(path_data="M0,0 L1,0 L1,1 Z"))

        # 图 / 有向图
        self.add(Graph(vertices=[1, 2, 3], edges=[(1, 2), (2, 3), (3, 1)]))
        self.add(DiGraph(vertices=[1, 2, 3], edges=[(1, 2), (2, 3)]))

        # 概率样本空间
        self.add(SampleSpace(width=4, height=3))

        # 变量与代码块
        self.add(Variable(label="t", value=1))
        self.add(Code(code="x = 1", language="python"))

        # 点组 / 名字表
        self.add(PGroup())
        self.add(VDict({"a": Dot(), "b": Square(side_length=0.4)}))

        # 单串公式（不做分段的那一支）
        self.add(SingleStringMathTex("x^2 + y^2"))

        # 向量场三兄弟：收一个函数（CE 收一个点、manim-web 收 (x, y) 并要返回真数组，适配层已接）
        field = lambda p: [-p[1], p[0], 0]
        self.add(VectorField(field, x_range=[-1, 1, 1], y_range=[-1, 1, 1]))
        self.add(ArrowVectorField(field, x_range=[-1, 1, 1], y_range=[-1, 1, 1]))
        self.add(StreamLines(field, x_range=[-1, 1, 1], y_range=[-1, 1, 1], num_lines=4))

        # 3D：一条 3D 线、一支 3D 箭头、一个由点算出来的三维凸包
        self.add(Line3D(ORIGIN, UP))
        self.add(Arrow3D(ORIGIN, UP))
        self.add(ConvexHull3D([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]]))
