"""TransformMatchingTex 公式变换

@expect 公式里相同的片段原地不动、不同的片段移动补位，不是整串打碎重排
（黄色 = 从 a = b 到 x = y 位置不变，a→x、b→y 补位）。
@browser 给「=」上色要按段取下标（a[1]），而 MathTex 的分段要等 KaTeX 异步排版才存在
——Node 假画布不排版，下标必 IndexError；真浏览器里没问题。由实验场页面核。
@note 别在排版完成前 copy MathTex 当 ghost：排版前的复制共享未填充的分段结构，
      会把 TransformMatchingTex 的对位数据污染成 aˣ = y b（实测）。同理 scale 在
      排版前调用也只是空操作。变换本身用探针验证过是干净的，别加戏。
"""

from manim import *


class TransformMatchingTexScene(Scene):
    def construct(self):
        a = MathTex("a", "=", "b")
        b = MathTex("x", "=", "y")
        a[1].set_color(YELLOW)
        b[1].set_color(YELLOW)
        self.add(a)
        self.play(TransformMatchingTex(a, b))
        self.wait(0.3)
