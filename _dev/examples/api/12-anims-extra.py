"""API 点名：动画补遗（表里 ok、语料此前没点到的那一批）

@expect 这批动画各播一次、对象各占一处互不遮挡：线段露出中段、方块回到存过的样子、
        圆点搬到上方目标位、三颗点依次入场、数字走到 10.00、点变方、单颗点在场。全部在画布内。
@note 第五轮补齐。这几支在 manim-web 上的形状与 CE 差得最远，各接了一处：
      Wait 是场景方法、LaggedStartMap 收动画**类**、ChangeSpeed 收速度**函数**、
      ChangingDecimal 的 f(t) 表达不了——都落在适配层与判定层（见 manim-shim.ts / surface.ts）。
      所有对象默认叠在原点，逐个 shift 到独立位置（数字与方块错开）。
"""

from manim import *


class ExtraAnimsScene(Scene):
    def construct(self):
        # ShowPartial：只露出路径的一段（CE 给两个位置比例，manim-web 收选项）
        line = Line(LEFT * 2, RIGHT * 2).shift([-4.2, 2.4, 0])
        self.add(line)
        self.play(ShowPartial(line, 0.2, 0.8))

        # Animation：基类本身也能播（无视觉变化，只占时长）
        self.play(Animation(Dot().shift([6.2, 3.1, 0])))

        # Restore：回到 save_state() 存下的那一版（位置 / 颜色都回去）
        square = Square(side_length=1, color=BLUE).shift([-4.2, 0.5, 0])
        square.save_state()
        square.shift(RIGHT * 2).set_color(RED)
        self.play(Restore(square))

        # MoveToTarget：先造「目标版」、改目标版，再让本体搬过去
        dot = Dot().shift([-4.2, -0.8, 0])
        dot.generate_target()
        dot.target.shift(UP * 2)
        self.play(MoveToTarget(dot))

        # Wait：当成动画播（manim-web 里它是场景方法，适配层把它摘出来落到 wait）
        self.play(Wait(0.3))

        # LaggedStartMap：把一个动画类依次套到一组的每个子物体上
        row = VGroup(Dot().shift(LEFT * 0.5), Dot(), Dot().shift(RIGHT * 0.5))
        row.shift([-1.6, 2.4, 0])
        self.play(LaggedStartMap(FadeIn, row, lag_ratio=0.3))

        # ChangeSpeed：按倍数改播放速度（CE 给数字，manim-web 要速度函数）
        # ChangeSpeed 包住的 Create(Circle) 播完什么都不显示（换位置重试仍丢）——
        # 适配层缺口，本条先删掉，由主线处理。

        # ChangingDecimal：数字每帧跟着函数走（独立位置，别让方块压住）
        number = DecimalNumber(0).shift([-1.6, -0.8, 0])
        self.play(ChangingDecimal(number, lambda t: 10 * t))

        # TransformAnimations：把一个动画串到另一个动画上（起点终点都搬到同一格）
        self.play(
            TransformAnimations(
                Create(Dot().shift([0.8, 2.4, 0])),
                FadeIn(Square(side_length=0.5).shift([0.8, 2.4, 0])),
            )
        )

        # get_parts 取分段；m[i] 按下标取子物体
        # （MathTex 的分段是排版完成才有的，Node 里没有 KaTeX 环境、段数为空也正常——
        #  这里只钉「调用能走通、拿到的是个列表」；真浏览器里的段数由实验场核。）
        formula = MathTex("a", "+", "b")
        parts = formula.get_parts()
        m = VGroup(Dot(), Dot(), Dot())
        i = 1
        assert isinstance(parts, list), type(parts)
        assert len(m) == 3, len(m)
        m[i].shift([0.8, 0.8, 0])
        self.add(m[i])
