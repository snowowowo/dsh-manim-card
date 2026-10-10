"""DotCloud：点云

@expect 不渲染：预检应当**当场**拒绝，报错要提到「DotCloud」并给出可读的原因或替代写法。
@reject DotCloud

@note manim-web 没有 DotCloud——散点用 VGroup(*[Dot(p) for p in points]) 拼
"""

from manim import *


class DotCloudScene(Scene):
    def construct(self):
        points = [[np.cos(t), np.sin(t), 0] for t in np.linspace(0, TAU, 60)]
        cloud = DotCloud(points)
        self.add(cloud)
