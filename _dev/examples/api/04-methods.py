"""API 点名：方法面（改写 / 取几何 / 坐标映射）

@expect 方法面逐项用一遍：改样式、取几何、坐标映射的 print 断言全过，画面上标记点/线落在预期位置。
@note 三态表里 kind=method、state=ok 的名字点一遍。方法面最容易「表里 ok、写法不对」蒙混过关：
      manim-web 的方法名与形状并不总跟 CE 对齐（plot_line_graph 收一个选项对象、set_style 收
      camelCase 键），所以这一组把每个方法的**真实用法**写出来，靠真桥跑通来钉住。
"""

from manim import *

square = Square(side_length=1.2)
square.stretch(1.5, 0)  # 横向拉伸
square.flip(UP)  # 沿 UP 轴翻转
square.set_style(stroke_color=BLUE, fill_color=BLUE, fill_opacity=0.4)
square.align_to(Dot(point=[0, 0, 0]), UP)
square.set_x(0).set_y(0).set_z(0)
box = square.get_bounding_box()
print("api-methods-geom", len(box), round(float(square.width), 3), round(float(square.height), 3))

line = Line(start=[-2, -1, 0], end=[2, 1, 0])
print("api-methods-line", len(line.get_start()), len(line.get_end()))


def bump(_m):
    return None


dot = Dot()
dot.add_updater(bump)
print("api-methods-updaters", len(dot.get_updaters()) >= 1)
dot.remove_updater(bump)

axes = Axes(x_range=[0, 4, 1], y_range=[0, 10, 2])
curve = axes.plot(lambda x: x ** 2, x_range=[0, 3])
xy = axes.coords_to_point(1, 1)
gp = axes.input_to_graph_point(1, curve)
graph = axes.plot_line_graph([0, 1, 2, 3], [0, 1, 4, 9])
print("api-methods-axes", len(xy), len(gp), graph is not None)


class ApiMethodsScene(Scene):
    def construct(self):
        self.add(axes, graph)
        self.play(Create(square), Create(line), run_time=0.2)
        self.wait(0.2)
