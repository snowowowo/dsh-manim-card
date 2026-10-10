/**
 * 集成测试：真 Pyodide(CPython) + 真 manim 适配层 + 真桥 + 真 manim-web 对象。
 * 只把 manim-web 的 Scene 换成一块假画布——真 Scene 要 DOM/WebGL，构造它属于 Client 半边的事；
 * 动画对象本身仍由真 manim-web 构造，所以「Create(circle) 有没有落成真的 Create 动画」是被验到的。
 */
import { describe, expect, it } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as manimModule from 'manim-web'
import { runPython, setPyodideLoader } from './runtime.ts'
import { createManimWebBridge } from './manim-bridge.ts'
import type { ManimNamespace } from './manim-bridge.ts'
import { createDryRunBridge } from './dry-run-bridge.ts'

const manim = manimModule as unknown as ManimNamespace

// 与 runtime.test.ts 同口径：用随包的 assets/pyodide，不走网络。
const pyodideDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets', 'pyodide')
setPyodideLoader(async () => {
  const { loadPyodide } = await import(pathToFileURL(join(pyodideDir, 'pyodide.mjs')).href)
  return loadPyodide({ indexURL: pyodideDir })
})

/** 假画布：记录被 add 的物体与被 play 的动画，好断言桥转发对了。 */
function fakeScene() {
  const added: unknown[][] = []
  const played: unknown[][] = []
  const waited: number[] = []
  let cleared = 0
  return {
    added,
    played,
    waited,
    get cleared() {
      return cleared
    },
    scene: {
      add: (...mobjects: unknown[]) => { added.push(mobjects) },
      play: async (...animations: unknown[]) => { played.push(animations) },
      wait: async (duration?: number) => { waited.push(duration ?? -1) },
      clear: () => { cleared += 1 },
    },
  }
}

describe('manim-web 桥', () => {
  it('把适配层的 add / play / wait 落到真 manim-web 对象上', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })

    await runPython(
      `from manim import *

class Demo(Scene):
    def construct(self):
        c = Circle(radius=1, color=BLUE)
        c.move_to([1.0, 0.0, 0.0])
        self.add(c)
        self.play(Create(c))
        self.wait(0.5)
`,
      bridge,
    )

    expect(canvas.added).toHaveLength(1)
    const circle = canvas.added[0][0]
    expect(circle).toBeInstanceOf(manimModule.Circle)

    expect(canvas.played).toHaveLength(1)
    const animation = canvas.played[0][0]
    expect(animation).toBeInstanceOf(manimModule.Create)
    // Create 动画的目标就是刚加进场景的那个圆——证明句柄一路传对了
    expect((animation as { mobject?: unknown }).mobject).toBe(circle)

    expect(canvas.waited).toEqual([0.5])
  })

  it('run_time 落到动画时长上', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        self.play(Create(c), run_time=0.5)
`,
      bridge,
    )
    const animation = canvas.played[0][0] as { duration?: number }
    expect(animation.duration).toBe(0.5)
  })

  it('多参动画：Transform(a, b) 的两个目标都进构造器', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        a = Circle(radius=1)
        b = Circle(radius=2)
        self.add(a, b)
        self.play(Transform(a, b))
`,
      bridge,
    )
    const animation = canvas.played[0][0]
    expect(animation).toBeInstanceOf(manimModule.Transform)
    // 动画两端就是刚 add 进去的两个圆——证明两个位置参数都传到了
    expect((animation as { mobject?: unknown }).mobject).toBe(canvas.added[0][0])
    expect((animation as { target?: unknown }).target).toBe(canvas.added[0][1])
  })

  it('组动画：AnimationGroup 收下一串动画对象', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        a = Circle(radius=1)
        b = Square(side_length=1)
        self.play(AnimationGroup([Create(a), FadeIn(b)]))
`,
      bridge,
    )
    const group = canvas.played[0][0] as { animations?: unknown[] }
    expect(group).toBeInstanceOf(manimModule.AnimationGroup)
    expect(group.animations).toHaveLength(2)
    expect(group.animations?.[0]).toBeInstanceOf(manimModule.Create)
    expect(group.animations?.[1]).toBeInstanceOf(manimModule.FadeIn)
  })

  it('方法名从 snake_case 落到 manim-web 的 camelCase', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=2)
        c.set_color(RED)
        self.add(c)
`,
      bridge,
    )
    const circle = canvas.added[0][0] as { color?: unknown }
    expect(circle.color).toBeDefined()
  })

  it('c2p 取点 + numpy 向量相加：合成一个位移向量', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
import numpy as np

def vec(x, y, z=0.0):
    return np.array((float(x), float(y), float(z)))

class Demo(Scene):
    def construct(self):
        ax = Axes(x_range=[-3, 3, 1], y_range=[-2, 2, 1])
        box = Rectangle(width=1, height=1)
        box.move_to(ax.c2p(0.0, 1.0, 0) + vec(0.5, 0.1, 0))
        self.add(box)
`,
      bridge,
    )
    // c2p 给 [0, 1.5, 0]，vec 给 [0.5, 0.1, 0] → 逐元素相加得 [0.5, 1.6, 0]
    const box = canvas.added[0][0] as { getCenter?: () => number[] }
    expect(box.getCenter?.()).toEqual([0.5, 1.6, 0])
  })

  // 公式（MathTex）不在 Node 里测：它要 KaTeX 与 DOM，放到浏览器里验。这里验的是
  // 裸 construct 体形态 + 生成的别名（Axes）+ 坐标系取点方法。
  it('裸 construct 体 + 坐标系（自检页那段）能跑通', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `ax = Axes(x_range=[-2, 2, 1], y_range=[-2, 2, 1])
circle = Circle(radius=1)
circle.move_to(ax.c2p(0, 0, 0))
circle.set_color("#247bbf")
self.add(ax, circle)
self.play(Create(ax), Create(circle))
`,
      bridge,
    )
    expect(canvas.added).toHaveLength(1)
    expect(canvas.played.map((anims) => anims.length)).toEqual([2])
    expect(canvas.played[0][0]).toBeInstanceOf(manimModule.Create)
  })

  it('animate 链落到真 manim-web 的 AnimateProxy 上', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        self.add(c)
        self.play(c.animate.shift(UP).scale(2), run_time=0.5)
`,
      bridge,
    )
    const animation = canvas.played[0][0] as { mobject?: unknown; duration?: number }
    expect(animation).toBeInstanceOf(manimModule.AnimateProxy)
    // 动画对象认的就是刚加进场景的那个圆——证明 animate 链一路挂在对的目标上
    expect(animation.mobject).toBe(canvas.added[0][0])
    // run_time 落到 animate 动画的时长上（与普通动画同一套封顶逻辑）
    expect(animation.duration).toBe(0.5)
  })

  it('rate_func：play 级速率名落到动画的 rateFunc 上', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        self.play(Create(c), rate_func=smooth)
`,
      bridge,
    )
    const animation = canvas.played[0][0] as { rateFunc?: unknown }
    expect(typeof animation.rateFunc).toBe('function')
  })

  it('rate_func：柯里化速率（running_start）拿到真函数而不是工厂', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        self.play(Create(c), rate_func=running_start)
`,
      bridge,
    )
    // 柯里化的导出是个「无参调用才返回速率函数」的工厂；没调那一层的话这里会拿到工厂本身
    const rate = (canvas.played[0][0] as { rateFunc: (t: number) => number }).rateFunc
    expect(typeof rate).toBe('function')
    expect(Number.isFinite(rate(0.5))).toBe(true)
  })

  it('逐动画的 rate_func / run_time 落到该动画自己的选项上', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        self.play(Create(c, rate_func=there_and_back, run_time=0.5))
`,
      bridge,
    )
    const animation = canvas.played[0][0] as { rateFunc?: unknown; duration?: number }
    expect(typeof animation.rateFunc).toBe('function')
    expect(animation.duration).toBe(0.5)
  })

  it('动画选项 shift：FadeIn(c, shift=UP) 的方向向量过桥后仍被 manim-web 接受', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        self.play(FadeIn(c, shift=UP))
`,
      bridge,
    )
    // UP 是 numpy 向量：没过 _tag_kwargs 降成 list 的话，真桥拿到的是个空壳，typia 会在构造时抛
    expect(canvas.played[0][0]).toBeInstanceOf(manimModule.FadeIn)
  })

  it('属性读取：width / height / color / opacity 拿到真值，不是可调用的函数包装', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    const printed: string[] = []
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        for name in ("width", "height", "color", "opacity"):
            value = getattr(c, name)
            print("PROP", name, callable(value), value)
`,
      bridge,
      { output: (text) => printed.push(text) },
    )
    // Pyodide 的 batched stdout 每次 print 回一块、不带换行，所以要自己补
    const text = printed.join('\n')
    const lines = text.split('\n').filter((line) => line.startsWith('PROP '))
    expect(lines).toHaveLength(4)
    // callable 一律 False 是这条的关键：老实现里 __getattr__ 对任何名字都回一个调用包装，c.width 会是个函数
    for (const line of lines) expect(line).toMatch(/^PROP \w+ False /)
    // 数值属性走 manim-web 的方法（getWidth），色值走存取器（color）——两条取法各验一个
    expect(text).toMatch(/^PROP width False [\d.]+$/m)
    expect(text).toMatch(/^PROP color False #\w+$/m)
  })

  it('m[i] 取子物体：VGroup 下标回一个 Mobject', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    const printed: string[] = []
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        v = VGroup(Circle(radius=1), Square(side_length=1))
        print("PART", type(v[0]).__name__)
        print("PART", type(v[1]).__name__)
`,
      bridge,
      { output: (text) => printed.push(text) },
    )
    const parts = printed.join('\n').split('\n').filter((line) => line.startsWith('PART '))
    expect(parts).toEqual(['PART Mobject', 'PART Mobject'])
  })

  it('Scene.clear() 转发到画布', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        self.add(Circle(radius=1))
        self.clear()
`,
      bridge,
    )
    expect(canvas.cleared).toBe(1)
  })

  it('碰到 manim-web 没有的方法时给出可读报错', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    const error = await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        c.this_method_does_not_exist()
`,
      bridge,
    ).catch((e: unknown) => e)
    expect(String(error)).toContain('this_method_does_not_exist')
  })

  // 事故回归：CE 把 TracedPath / AnimatedBoundary 放在 manim/animation/changing.py 里，
  // 两者其实 extends VMobject。早期按「CE 挂在哪个模块下」归类 ⇒ 记成动画 ⇒ 适配层生成
  // _Animation 工厂 ⇒ self.add(traced, dot) 过桥报「未知的对象句柄 <manim._Animation object>」。
  it('TracedPath / AnimatedBoundary 按物体构造，且能 add 进场景', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        dot = Dot(color=YELLOW)
        traced = TracedPath(dot, stroke_color=RED, stroke_width=4)
        boundary = AnimatedBoundary(dot)
        self.add(traced, dot, boundary)
`,
      bridge,
    )
    const [traced, dot, boundary] = canvas.added[0] as [Record<string, unknown>, unknown, unknown]
    expect(traced).toBeInstanceOf(manimModule.TracedPath)
    expect(dot).toBeInstanceOf(manimModule.Dot)
    expect(boundary).toBeInstanceOf(manimModule.AnimatedBoundary)
    // 被追踪的物体是当**独立位置参数**传进构造器的（leading），不是塞进选项对象的键里
    expect(traced.trackedMobject).toBe(dot)
  })

  it('Scene.add 收到动画：当场拦下并说清该用 self.play（预检与真桥都拦得住）', async () => {
    const code = `from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        self.add(Create(c))
`
    // 拦在适配层的纯 Python 里，所以两个桥同判——事故当时预检放过了、到渲染期才炸出看不懂的报错
    for (const bridge of [createManimWebBridge({ manim, scene: fakeScene().scene }), createDryRunBridge()]) {
      const error = await runPython(code, bridge).catch((e: unknown) => e)
      expect(String(error)).toContain('只接受物体')
      expect(String(error)).toContain('self.play')
    }
  })

  it('整段回归：TracedPath 追踪 + add_updater + Indicate（用户报障的那段程序）', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
import numpy as np

class SineTrace(Scene):
    def construct(self):
        ax = Axes(x_range=[0, TAU, PI / 2], y_range=[-1.5, 1.5, 1], x_length=7.0, y_length=3.4)
        graph = ax.plot(lambda x: np.sin(x), color=BLUE, x_range=[0, TAU])

        self.play(Create(ax))
        self.play(Create(graph), run_time=1.2)

        state = {"x": 0.0}
        dot = Dot(color=YELLOW, radius=0.09)

        def follow(m, dt):
            state["x"] = min(state["x"] + dt * 1.5, float(TAU))
            m.move_to(ax.c2p(state["x"], np.sin(state["x"])))

        dot.add_updater(follow)
        traced = TracedPath(dot, stroke_color=RED, stroke_width=4)

        self.add(traced, dot)
        self.play(Indicate(dot, scale_factor=1.5), run_time=0.6)
        self.wait(4.4)
`,
      bridge,
    )
    // 报障点在原第 28 行 self.add(traced, dot)：这里必须真的把物体挂上去
    expect(canvas.added).toHaveLength(1)
    expect(canvas.added[0][0]).toBeInstanceOf(manimModule.TracedPath)
    expect(canvas.added[0][1]).toBeInstanceOf(manimModule.Dot)
    // 三段 play：Create(ax) / Create(graph) / Indicate(dot)
    expect(canvas.played).toHaveLength(3)
    for (const anims of canvas.played) expect(anims[0]).toBeInstanceOf(manimModule.Animation)
    expect(canvas.waited).toEqual([4.4])
  })

  it('方法改写：set_stroke / set_opacity / put_start_and_end_on 在普通物体（Line）上真的生效', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        line = Line([-1, 0, 0], [1, 0, 0])
        line.set_stroke(color=RED, width=4, opacity=0.5)
        line.put_start_and_end_on([-2, -1, 0], [2, 1, 0])
        self.add(line)
`,
      bridge,
    )
    const line = canvas.added[0][0] as {
      strokeColor: string
      strokeWidth: number
      opacity: number
      getStart(): number[]
      getEnd(): number[]
    }
    // 老实现里 manim-web 的 Mobject 没有 setStroke，这三行都会「无对应方法」炸掉。
    // 颜色断言读 strokeColor 通道：set color 存取器会把 fillColor 一起冲掉（见 MethodCall 的注），
    // set_stroke 的颜色改走属性写，只动描边。
    expect(line.strokeWidth).toBe(4)
    expect(line.opacity).toBeCloseTo(0.5)
    expect(line.strokeColor.toUpperCase()).toBe('#FC6255')
    // Line 没有 putStartAndEndOn，走的是 setStart + setEnd
    expect(line.getStart().slice(0, 2)).toEqual([-2, -1])
    expect(line.getEnd().slice(0, 2)).toEqual([2, 1])
  })

  it('方法改写：set_opacity 同时落到 stroke 与 fill（CE 语义）', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        circle = Circle(radius=1)
        circle.set_opacity(0.4)
        self.add(circle)
`,
      bridge,
    )
    const circle = canvas.added[0][0] as { opacity: number; fillOpacity: number }
    expect(circle.opacity).toBeCloseTo(0.4)
    expect(circle.fillOpacity).toBeCloseTo(0.4)
  })

  it('方法改写：Arrow 上 put_start_and_end_on 用 manim-web 的同名方法（不是 Line 那组）', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        arrow = Arrow([-1, 0, 0], [1, 0, 0])
        arrow.put_start_and_end_on([0, 0, 0], [4, 0, 0])
        self.add(arrow)
`,
      bridge,
    )
    const arrow = canvas.added[0][0] as { getCenter(): number[] }
    // Arrow 是 VGroup 子类，没有 setStart/setEnd——候选组要按「接收者上真有哪个」挑
    expect(arrow.getCenter()[0]).toBeCloseTo(2, 1)
  })

  it('整段回归：模型按标准 CE 写的追迹程序（含 set_stroke / put_start_and_end_on）跑通', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
import numpy as np


class UnitCircleSine(Scene):
    def construct(self):
        title = MathTex(r"y=\\sin\\theta").to_edge(UP)
        self.play(Write(title))

        C = np.array([-4.0, 0.2, 0.0])
        R = 1.3
        x0, x1, ybase = 0.6, 6.2, 0.2

        circle = Circle(radius=R, color=BLUE).move_to(C)
        center = Dot(C, color=WHITE)
        radius_line = Line(C, C + RIGHT * R, color=YELLOW)
        dot = Dot(C + RIGHT * R, color=YELLOW, radius=0.09)

        x_axis = Line(np.array([x0, ybase, 0.0]), np.array([x1, ybase, 0.0]), color=GRAY)
        y_axis = Line(np.array([x0, ybase - 1.5, 0.0]), np.array([x0, ybase + 1.5, 0.0]), color=GRAY)
        labels = VGroup(
            MathTex("0").scale(0.6).move_to(np.array([x0, ybase - 0.4, 0.0])),
            MathTex(r"2\\pi").scale(0.6).move_to(np.array([x1, ybase - 0.4, 0.0])),
        )

        tracer = Dot(np.array([x0, ybase, 0.0]), color=RED, radius=0.06)
        connector = Line(C + RIGHT * R, np.array([x0, ybase, 0.0]), color=GRAY_B)
        connector.set_stroke(opacity=0.5)

        self.play(Create(circle), FadeIn(center), FadeIn(dot), Create(radius_line))
        self.play(Create(x_axis), Create(y_axis), FadeIn(labels))

        trace = TracedPath(tracer)
        trace.set_stroke(color=RED, width=4)
        self.add(trace, tracer, connector)

        state = {"t": 0.0}

        def updater(mob, dt):
            state["t"] = min(state["t"] + dt * 1.1, TAU)
            ang = state["t"]
            pos = C + np.array([np.cos(ang), np.sin(ang), 0.0]) * R
            dot.move_to(pos)
            radius_line.put_start_and_end_on(C, pos)
            px = x0 + (x1 - x0) * ang / TAU
            py = ybase + 1.1 * np.sin(ang)
            tracer.move_to(np.array([px, py, 0.0]))
            connector.put_start_and_end_on(pos, tracer.get_center())

        dot.add_updater(updater)
        for _ in range(24):
            self.wait(0.4)
        dot.remove_updater(updater)
        self.wait(1)
`,
      bridge,
    )
    expect(canvas.played).toHaveLength(3)
    expect(canvas.waited).toHaveLength(25)
    expect(canvas.added).toHaveLength(1)
    expect(canvas.added[0][0]).toBeInstanceOf(manimModule.TracedPath)
  })

  it('整段回归：轨迹里真实翻车的构造器写法（RightAngle / Vector / ParametricFunction 位置参数）', async () => {
    // 2026-10-09 会话：这三个类的位置参数此前一律被拒、或关键字里的句柄标记没解析
    // （「e.line1.getStart is not a function」就是 kwargs 里的 {__handle} 空壳被当真对象用）。
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *
import numpy as np


class Demo(Scene):
    def construct(self):
        l1 = Line([-1.0, -1.0, 0.0], [0.0, 1.0, 0.0])
        l2 = Line([0.0, 1.0, 0.0], [1.0, -1.0, 0.0])
        right = RightAngle(l1, l2, length=0.3, color=YELLOW)
        kw_form = RightAngle(line1=l1, line2=l2, length=0.3, color=RED)
        vec = Vector([2.0, 1.0, 0.0], color=RED)
        curve = ParametricFunction(lambda t: np.array([t - 3.0, np.sin(t), 0.0]), t_range=[0, TAU], color=BLUE)
        brace = Brace(l1)
        tracker = ValueTracker(0.5)
        self.add(right, kw_form, vec, curve, brace, tracker)
`,
      bridge,
    )
    expect(canvas.added[0]).toHaveLength(6)
    const [right, kwForm, vec, curve, brace] = canvas.added[0]
    expect(right).toBeInstanceOf(manimModule.RightAngle)
    expect(kwForm).toBeInstanceOf(manimModule.RightAngle)
    expect(vec).toBeInstanceOf(manimModule.Vector)
    expect(curve).toBeInstanceOf(manimModule.ParametricFunction)
    expect(brace).toBeInstanceOf(manimModule.Brace)
  })

  it('MathTex 构造后自动等渲染：construct 里的定位链不报错（flush 兜底吞掉渲染失败）', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene })
    await runPython(
      `from manim import *


class Demo(Scene):
    def construct(self):
        tag = MathTex("n=61").to_corner(UR)
        two = MathTex("a^2")
        two.next_to(tag, DOWN)
        self.add(tag, two)
        self.play(Write(two))
`,
      bridge,
    )
    expect(canvas.added[0]).toHaveLength(2)
  })

  // 极速模式：批量跑上百条语料时按 run_time 真等要几分钟，所以把时长压到 0
  // （manim-web 对 duration<=0 的动画直接取 alpha=1 落终态），wait 也直接省掉。
  it('极速：run_time 被压到 0（不等时间，直接落终态）', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene, fast: true })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        self.play(Create(c), run_time=3)
`,
      bridge,
    )
    expect((canvas.played[0][0] as { duration?: number }).duration).toBe(0)
  })

  it('极速：wait 不落到画布上（真等被省掉）', async () => {
    const canvas = fakeScene()
    const bridge = createManimWebBridge({ manim, scene: canvas.scene, fast: true })
    await runPython(
      `from manim import *
class Demo(Scene):
    def construct(self):
        self.add(Circle(radius=1))
        self.wait(5)
`,
      bridge,
    )
    expect(canvas.waited).toEqual([])
  })
})
