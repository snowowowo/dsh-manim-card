"""API 点名：场景家族

@expect ThreeDScene / MovingCameraScene 等作为基类继承后正常建场景、正常渲染，不炸不空白。
@note ThreeDScene / MovingCameraScene / ZoomedScene / LinearTransformationScene 在适配层里
      统一继承 Scene（本实现只有一块画布，共用同一个句柄）。写成基类用一下，钉住「名字解析得到」。
      每个 construct 里放一个参照物——终帧空白与否一眼可辨。
"""

from manim import *


def marker(label):
    return VGroup(
        Square(side_length=1.6, color=BLUE),
        Text(label, font_size=26, color=WHITE),
    ).move_to([0, 0, 0])


class ApiSceneFamily(ThreeDScene):
    def construct(self):
        self.add(marker("ThreeDScene ok"))
        self.wait(0.1)


class _FamilyMovingCamera(MovingCameraScene):
    def construct(self):
        self.add(marker("MovingCamera ok"))
        self.wait(0.1)


class _FamilyZoomed(ZoomedScene):
    def construct(self):
        self.add(marker("ZoomedScene ok"))
        self.wait(0.1)


class _FamilyLinear(LinearTransformationScene):
    def construct(self):
        self.add(marker("LinearTransform ok"))
        self.wait(0.1)
