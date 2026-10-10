"""API 点名：矩阵 / 表 / 3D / 杂项

@expect 网格布局：3D 实体一格一个、矩阵一行四个、杂项一行四个，格旁有名字标签，
        互不遮挡、全部在画布内。
@note 同上一组：只钉「名字能用」。3D 物体默认全叠在原点，必须逐个 shift 到独立格子；
      矩阵的数字块也会叠字，错开摆放。
"""

from manim import *

dmat = DecimalMatrix([[1.0, 2.0], [3.0, 4.0]], h_buff=2.0)  # 默认列距太窄，小数粘连
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
vm3 = ThreeDVMobject()  # 空几何，不进画面

print("api-classes-3d", mmat is not None, mtab is not None, impl is not None, banner is not None)

# —— 网格布局 ——
COLS4 = [-5.25, -1.75, 1.75, 5.25]
SOLID_ROWS = [2.85, 1.5, 0.15]
MAT_Y = -1.7
MISC_Y = -2.95


class ApiStructuresScene(Scene):
    def construct(self):
        solids = [
            ("Cube", cube, 0.4), ("Sphere", sphere, 0.4), ("Cone", cone, 0.4),
            ("Cylinder", cylinder, 0.4),
            ("Torus", torus, 0.4), ("Prism", prism, 0.4), ("Tetrahedron", tetra, 0.4),
            ("Octahedron", octa, 0.4),
            ("Dodecahedron", dodeca, 0.4), ("Icosahedron", icosa, 0.4), ("Dot3D", dot3, 1.6),
            ("ThreeDAxes", axes3, 0.25, -0.4),  # 轴默认横跨画布，缩更小并下移，别穿过上排
        ]
        for i, (name, mob, s, *dy) in enumerate(solids):
            r, c = divmod(i, len(COLS4))
            mob.scale(s)
            mob.set_fill(opacity=0.45).set_stroke(WHITE, 1)  # 黑实心块看不出立体感
            mob.shift([COLS4[c], SOLID_ROWS[r] + 0.3 + (dy[0] if dy else 0), 0])
            label = Text(name, font_size=11).move_to([COLS4[c], SOLID_ROWS[r] - 0.42, 0])
            self.add(label, mob)

        mats = [
            ("DecimalMatrix", dmat), ("IntegerMatrix", imat),
            ("MobjectMatrix", mmat), ("MobjectTable", mtab),
        ]
        for i, (name, mob) in enumerate(mats):
            s = 0.9 if i < 2 else 0.5  # 装实体的矩阵/表天生太宽，缩得更小
            mob.scale(s).move_to([COLS4[i], MAT_Y, 0])
            label = Text(name, font_size=11).move_to([COLS4[i], MAT_Y - 0.75, 0])
            self.add(label, mob)

        misc = [
            ("Integer", num, 1.0), ("AnimatedBoundary", boundary, 0.25, -0.25),
            ("ImplicitFunction", impl, 0.45, -0.15), ("ManimBanner", banner, 0.3),
        ]
        for i, (name, mob, s, *dy) in enumerate(misc):
            mob.scale(s).move_to([COLS4[i], MISC_Y + 0.15 + (dy[0] if dy else 0), 0])
            label = Text(name, font_size=11).move_to([COLS4[i], MISC_Y - 0.45, 0])
            self.add(label, mob)

        self.play(Write(dmat), run_time=0.2)
        self.wait(0.2)
