"""ImageMobjectFromCamera：把相机画面变成物体

@expect 不渲染：预检应当**当场**拒绝，报错要提到「ImageMobjectFromCamera」并给出可读的原因或替代写法。
@reject ImageMobjectFromCamera

@note manim-web 没有 ImageMobjectFromCamera——需要截图请用 ImageMobject 自己喂图
"""

from manim import *


class CameraImageScene(Scene):
    def construct(self):
        frame = ImageMobjectFromCamera()
        self.add(frame)
