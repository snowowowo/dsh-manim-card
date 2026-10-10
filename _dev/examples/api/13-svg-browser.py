"""API 点名：整段 SVG 字符串（要浏览器 DOM，只在实验场核）

@expect 从一段内联 SVG 字符串里解析出图形（一个圆）并画出来。
@browser manim-web 的 SVGMobject 用 DOMParser 解析 SVG——那是浏览器 API，Node 里没有，
         所以这条只由实验场页面（真浏览器）核；Node 套件会打印出跳过了它。
@note 与 VMobjectFromSVGPath 不同：只给一条路径 d 时不需要 DOM（那条在 11 里、自动测试覆盖）。
"""

from manim import *


class SvgStringScene(Scene):
    def construct(self):
        svg = "<svg viewBox='0 0 10 10'><circle cx='5' cy='5' r='4'/></svg>"
        self.add(SVGMobject(svg_string=svg))
