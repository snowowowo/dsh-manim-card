"""API 点名：矩阵 / 表 / 3D / 杂项

@expect 矩阵/表格/3D 实体（立方体、球、锥、环面等）各自成形，3D 类有立体感、不糊成一团。
@note 同上一组：只钉「名字能用」。3D 物体在本实现里共用一块 2D 画布，构造与加场景都通得过，
      画出来什么样不在这里断言。
"""

from manim import *

dmat = DecimalMatrix([[1.0, 2.0], [3.0, 4.0]])
imat = IntegerMatrix([[1, 2], [3, 4]])
mmat = MobjectMatrix([[Square(), Circle()]])
mtab = MobjectTable([[Square(), Circle()]])
num = Integer(7)
boundary = AnimatedBoundary(Square())
impl = ImplicitFunction(lambda x, y: x ** 2 + y ** 2 - 1)
banner = ManimBanner()

cube = Cube()
sphere = Sphere()
cone = Cone()
cylinder = Cylinder()
torus = Torus()
prism = Prism()
tetra = Tetrahedron()
octa = Octahedron()
dodeca = Dodecahedron()
icosa = Icosahedron()
dot3 = Dot3D()
axes3 = ThreeDAxes()
vm3 = ThreeDVMobject()

print("api-classes-3d", mmat is not None, mtab is not None, impl is not None, banner is not None)


class ApiStructuresScene(Scene):
    def construct(self):
        self.add(
            dmat, imat, mmat, mtab, num, boundary, banner,
            cube, sphere, cone, cylinder, torus, prism, tetra, octa, dodeca, icosa,
            dot3, axes3, vm3,
        )
        self.play(Write(dmat), run_time=0.2)
        self.wait(0.2)
