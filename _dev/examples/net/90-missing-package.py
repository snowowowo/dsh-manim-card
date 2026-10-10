"""import 了取不到的包：报错要能读

@expect 不渲染：报错要能读——说清是哪个包取不到、下一步怎么办。
@reject tensorflow

@note 这不是「写法被拒」，而是「这条路走不通」：Pyodide 的包目录（pyodide-lock.json）里没有
      tensorflow，取包阶段就会失败。拒可以，但必须说清是哪个包——否则用户只看到
      ModuleNotFoundError，读不出「首次要联网 / 这个包 Pyodide 根本没有」。
"""

from manim import *
import tensorflow


class MissingPackageScene(Scene):
    def construct(self):
        self.wait(0.1)
