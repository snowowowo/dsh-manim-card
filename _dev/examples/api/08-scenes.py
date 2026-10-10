"""API 点名：场景家族

@expect ThreeDScene / MovingCameraScene 等作为基类继承后正常建场景、正常渲染，不炸不空白。
@note ThreeDScene / MovingCameraScene / ZoomedScene / LinearTransformationScene 在适配层里
      统一继承 Scene（本实现只有一块画布，共用同一个句柄）。写成基类用一下，钉住「名字解析得到」。
"""

from manim import *


class ApiSceneFamily(ThreeDScene):
    def construct(self):
        self.wait(0.1)


class _FamilyMovingCamera(MovingCameraScene):
    pass


class _FamilyZoomed(ZoomedScene):
    pass


class _FamilyLinear(LinearTransformationScene):
    pass
