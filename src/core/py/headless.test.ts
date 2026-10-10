/**
 * 真 headless 画布回归：**动画与 updater 真的会被驱动**。
 *
 * 为什么单开一份：`manim-bridge.test.ts` / `examples.test.ts` 用的假画布把 play / wait 换成空函数，
 * 于是「动画有没有真的跑、updater 有没有被调到」根本没被验到。踩过的两个坑都躲在那个盲区里：
 *
 *  - updater 收到的第一个参数是 manim-web 的**裸 JS 对象**（只有 camelCase 方法），
 *    模型写的 `lambda m: m.move_to(...)` 直接 AttributeError；
 *  - 单参 updater 被 manim-web 按 (mobject, dt) 调用，抛 "takes 1 positional argument but 2 were given"。
 *
 * 两个错都抛在**渲染循环里**：manim-web 捕获后停掉循环，play 的 promise 永远不 resolve，
 * 页面一直转。所以这里用真的 headless Scene 把整条路走通，并把「极速模式不真等」也钉死。
 */
import { describe, expect, it } from 'vitest'
import * as manimModule from 'manim-web'
import { runPython, setPyodideLoader } from './runtime.ts'
import { createManimWebBridge, type ManimNamespace } from './manim-bridge.ts'
import { testPyodideLoader } from '../../../scripts/test-pyodide.mjs'

const manim = manimModule as unknown as ManimNamespace

// 装载细节（临时缓存目录 + 先铺随包 wheel，两条理由）见 scripts/test-pyodide.mjs。
setPyodideLoader(testPyodideLoader('headless'))

// headless 场景带 updater 的 wait 走 requestAnimationFrame，Node 里没有——补一个，
// 否则真等待直接 ReferenceError（实测）。
const globals = globalThis as unknown as Record<string, unknown>
globals.requestAnimationFrame ??= (callback: (time: number) => void): number =>
  Number(setTimeout(() => callback(performance.now()), 16))
globals.cancelAnimationFrame ??= (id: number): void => { clearTimeout(id) }

/** 真 headless Scene：不碰 DOM / WebGL，但动画、时间线、updater 都是真的。 */
function headless(): object {
  const Scene = (manimModule as unknown as { Scene: { createHeadless(options?: unknown): object } }).Scene
  return Scene.createHeadless({ width: 1280, height: 720 })
}

/** 跑一段代码，收 print 的输出（用于把「跑完到底什么样」带出来断言）。 */
async function run(code: string, fast: boolean): Promise<{ text: string; ms: number }> {
  const printed: string[] = []
  const started = performance.now()
  await runPython(code, createManimWebBridge({ manim, scene: headless(), fast }), {
    output: (text) => printed.push(text),
  })
  return { text: printed.join('\n'), ms: performance.now() - started }
}

/** tracker 驱动一个点：单参 lambda + CE 方法名（move_to），两个坑都在这一行里。 */
const TRACKER = `from manim import *


class Demo(Scene):
    def construct(self):
        tracker = ValueTracker(0)
        dot = Dot(point=[-2, 0, 0], color=RED)
        dot.add_updater(lambda m: m.move_to([tracker.get_value() - 2, 0, 0]))
        self.add(tracker, dot)
        self.play(tracker.animate.set_value(2), run_time=0.2)
        self.wait(0.05)
        print("CENTER", round(float(dot.get_center()[0]), 3))
`

/** 取 print 出来的 CENTER 行。 */
function center(text: string): number {
  const line = text.split('\n').find((item) => item.startsWith('CENTER'))
  expect(line, `没有拿到 CENTER 行：\n${text}`).toBeDefined()
  return Number(line!.slice('CENTER'.length).trim())
}

describe('真画布：updater 与动画确实被驱动', () => {
  it('单参 lambda + CE 方法名能真的把点挪走（move_to 落到最终位置）', async () => {
    const { text } = await run(TRACKER, false)
    // tracker 从 0 走到 2 → 点从 -2 挪到 0
    expect(center(text)).toBeCloseTo(0, 1)
  }, 60_000)

  it('dt 双参 updater：wait 期间按真实时间推进', async () => {
    const { text } = await run(
      `from manim import *


class Demo(Scene):
    def construct(self):
        dot = Dot(point=[0, 0, 0], color=RED)

        def step(m, dt):
            m.shift(RIGHT * dt * 2)

        dot.add_updater(step)
        self.add(dot)
        self.wait(0.3)
        print("CENTER", round(float(dot.get_center()[0]), 2))
`,
      false,
    )
    // 0.3 秒每秒走 2 个单位：至少走了一小段（不断言精确值——帧数不定）
    expect(center(text)).toBeGreaterThan(0.2)
  }, 60_000)
})

/** 取 print 出来的 OPACITY 行（源、目标两个不透明度）。 */
function opacities(text: string): [number, number] {
  const line = text.split('\n').find((item) => item.startsWith('OPACITY'))
  expect(line, `没有拿到 OPACITY 行：\n${text}`).toBeDefined()
  const [source, target] = line!.slice('OPACITY'.length).trim().split(/\s+/).map(Number)
  return [source, target]
}

/** 取 print 出来的单个数字行（如 WIDTH 4）。 */
function numberLine(text: string, tag: string): number {
  const line = text.split('\n').find((item) => item.startsWith(tag))
  expect(line, `没有拿到 ${tag} 行：\n${text}`).toBeDefined()
  return Number(line!.slice(tag.length).trim())
}

/**
 * manim-web 的「点数对齐」型动画（`Transform` / `ReplacementTransform` / `FadeTransform` /
 * `FadeTransformPieces` / `ClockwiseTransform` / `CounterclockwiseTransform`）在 `begin()` 里
 * **直接调 `alignVmobjectPair`（或经 PointMorphStrategy）、没有任何兜底**：两端点数对不齐就抛
 * `alignVmobjectPair: alignPoints fallback produced mismatched point counts`（真机事故文案是 905 vs 589）。
 * 它抛在**渲染循环里** → play 的 promise 永不 resolve、页面一直转；而假画布（play / wait 换空函数）
 * 把动画整个跳过，根本看不见这个坑。所以只能钉在真场景里。
 *
 * 适配层的应付：真跑前拿**复制品试跑一次 begin()**——对得齐就用真动画（保住 morph），对不齐才退到交叉淡入淡出。
 * 所以断言分两头：「抛过的那几对不再抛」（源淡到 0、目标淡到 1）＋「对得齐的一对仍真 morph」（宽度真的变过去）。
 */
describe('真画布：点数对不齐的 morph 动画不再打死渲染循环', () => {
  const script = (source: string, target: string, animation: string, probe: string): string => `from manim import *


class Demo(Scene):
    def construct(self):
        a = ${source}
        b = ${target}
        self.add(a)
        self.play(${animation}, run_time=0.3)
        ${probe}
`
  const opacify = (source: string, target: string, animation: string): string =>
    script(source, target, animation, 'print("OPACITY", round(float(a.opacity), 2), round(float(b.opacity), 2))')

  it('FadeTransform：点数不一致的 VGroup 对（子物个数也不同）', async () => {
    const { text } = await run(opacify('VGroup(Triangle(), Circle(), Square())', 'VGroup(Circle())', 'FadeTransform(a, b)'), false)
    const [source, target] = opacities(text)
    expect(source).toBeCloseTo(0, 1)
    expect(target).toBeCloseTo(1, 1)
  }, 60_000)

  it('FadeTransform：Arrow → Star', async () => {
    const { text } = await run(opacify('Arrow()', 'Star()', 'FadeTransform(a, b)'), false)
    const [source, target] = opacities(text)
    expect(source).toBeCloseTo(0, 1)
    expect(target).toBeCloseTo(1, 1)
  }, 60_000)

  it('Transform / ReplacementTransform：Arrow → Star 也不抛', async () => {
    for (const animation of ['Transform(a, b)', 'ReplacementTransform(a, b)']) {
      const { text } = await run(opacify('Arrow()', 'Star()', animation), false)
      const [source, target] = opacities(text)
      expect(source, animation).toBeCloseTo(0, 1)
      expect(target, animation).toBeCloseTo(1, 1)
    }
  }, 60_000)

  it('Clockwise / Counterclockwise：VGroup 对不齐也不抛', async () => {
    for (const animation of ['ClockwiseTransform(a, b)', 'CounterclockwiseTransform(a, b)']) {
      const { text } = await run(opacify('VGroup(Triangle(), Square())', 'VGroup(Circle())', animation), false)
      const [source, target] = opacities(text)
      expect(source, animation).toBeCloseTo(0, 1)
      expect(target, animation).toBeCloseTo(1, 1)
    }
  }, 60_000)

  it('对得齐的一对仍走真 morph（不误退兜底）', async () => {
    // Circle 半径 1（宽 2）→ Square(side_length=4)：这一对能对齐，所以 a 的宽度要真的变到 4；
    // 若被误退成交叉淡入淡出，a 不动、宽度仍是 2。
    const { text } = await run(
      script('Circle()', 'Square(side_length=4)', 'Transform(a, b)', 'print("WIDTH", round(float(a.width), 2))'),
      false,
    )
    expect(numberLine(text, 'WIDTH')).toBeCloseTo(4, 1)
  }, 60_000)
})

describe('极速模式：不真等，但把 updater 推到终态', () => {
  it('run_time=3 与 wait(3) 都不花真实时间，点仍落到最终位置', async () => {
    const { text, ms } = await run(
      `from manim import *


class Demo(Scene):
    def construct(self):
        tracker = ValueTracker(0)
        dot = Dot(point=[-2, 0, 0], color=RED)
        dot.add_updater(lambda m: m.move_to([tracker.get_value() - 2, 0, 0]))
        self.add(tracker, dot)
        self.play(tracker.animate.set_value(2), run_time=3)
        self.wait(3)
        print("CENTER", round(float(dot.get_center()[0]), 3))
`,
      true,
    )
    expect(center(text)).toBeCloseTo(0, 2)
    // 按真实时间要 6 秒；极速下一帧就完事，给足余量仍然远小于 6 秒
    expect(ms).toBeLessThan(3_000)
  }, 60_000)

  it('updater 推的是「整段时长」，不是只走一步', async () => {
    const { text } = await run(
      `from manim import *


class Demo(Scene):
    def construct(self):
        dot = Dot(point=[0, 0, 0], color=RED)

        def step(m, dt):
            m.shift(RIGHT * dt)

        dot.add_updater(step)
        self.add(dot)
        self.wait(2.0)
        print("CENTER", round(float(dot.get_center()[0]), 2))
`,
      true,
    )
    // 2 秒每秒走 1 个单位 → 约 2；只走一步的话会是 1/60 左右
    expect(center(text)).toBeCloseTo(2, 1)
  }, 60_000)
})

/**
 * manim-web 的 `UpdateFromFunc` / `UpdateFromAlphaFunc` 回调签名是 `func(mobject, alpha)`
 * （两个类的 `interpolate` 里就是 `this._func(this.mobject, alpha)`），那个 mobject 是它自己的
 * **裸 JS 对象**——与 `add_updater` 同一个坑的另一个入口：模型按 CE 习惯写的
 * `lambda m, alpha: m.set_opacity(...)` 当场 AttributeError，且抛在**渲染循环里**，
 * 循环被停掉、play 的 promise 永不 resolve，卡片一直「渲染中」（真机现象：一直转 + 日志里
 * `headless render loop error ... AttributeError: set_opacity`）。所以只能钉在真画布上。
 */
describe('真画布：更新函数的回调看到的是 Python 包装，不是裸 JS 对象', () => {
  it('UpdateFromAlphaFunc：回调里 m.set_opacity(...) 打得开', async () => {
    const { text } = await run(
      `from manim import *


class Demo(Scene):
    def construct(self):
        sq = Square(color=BLUE)
        self.add(sq)
        self.play(UpdateFromAlphaFunc(sq, lambda m, alpha: m.set_opacity(alpha)), run_time=0.3)
        print("OPACITY", round(float(sq.opacity), 2))
`,
      false,
    )
    // alpha 从 0 走到 1：跑完必须回到不透明；AttributeError 的话这里拿不到 OPACITY 行
    expect(numberLine(text, 'OPACITY')).toBeCloseTo(1, 1)
  }, 60_000)

  it('UpdateFromFunc：CE 习惯的单参回调也收得下（manim-web 固定按双参调）', async () => {
    const { text } = await run(
      `from manim import *


class Demo(Scene):
    def construct(self):
        dot = Dot(point=[0, 0, 0], color=RED)
        self.add(dot)
        self.play(UpdateFromFunc(dot, lambda m: m.move_to([1, 0, 0])), run_time=0.2)
        print("CENTER", round(float(dot.get_center()[0]), 2))
`,
      false,
    )
    expect(center(text)).toBeCloseTo(1, 1)
  }, 60_000)

  it('组合写法：点数对不齐的 morph 后面接 UpdateFromAlphaFunc 也跑得完', async () => {
    // 用户事故就是这两样叠在一起（FadeTransform(eq, result) + UpdateFromAlphaFunc）。这里**故意**
    // 不用 MathTex：MathTex 在 Node 里没有 DOM，构造时发起的异步排版必然 reject
    // （svgElement has no tagName），会让整轮 vitest 以「有未处理拒绝」退出 1——那是 Node 环境
    // 的固有噪声，跟被测行为无关。文本那一对由语料回归（假画布）与真机自测覆盖。
    const { text } = await run(
      `from manim import *


class Demo(Scene):
    def construct(self):
        source = Arrow()
        target = Star()
        self.add(source)
        self.play(FadeTransform(source, target), run_time=0.3)
        self.play(UpdateFromAlphaFunc(target, lambda m, alpha: m.set_opacity(0.2 + 0.8 * alpha)), run_time=0.3)
        print("OPACITY", round(float(source.opacity), 2), round(float(target.opacity), 2))
`,
      false,
    )
    const [sourceOpacity, targetOpacity] = opacities(text)
    // 源淡掉、目标亮出来——两处坑（点数对不齐、回调参数）都按兜底/包装走通
    expect(sourceOpacity).toBeCloseTo(0, 1)
    expect(targetOpacity).toBeCloseTo(1, 1)
  }, 60_000)
})

/**
 * VGroup 遍历：真机事故——`for m in group:` 会**卡死**。
 *
 * 适配层越界取不到子物体时只把 None 原样返回（真桥的 get(i) 越界就是 undefined），
 * Python 的迭代协议靠 IndexError 收尾，收不到尾就永远取「下一个」，一路把内存吃满。
 * 这里用真画布钉死契约：迭代按子物体数收尾，越界下标当场抛 IndexError。
 */
describe('真画布：VGroup 遍历按子物体数收尾', () => {
  it('for / 推导式 / 越界下标', async () => {
    const { text } = await run(
      `from manim import *


class Demo(Scene):
    def construct(self):
        dots = VGroup(*[Dot(point=[i - 2, 0, 0]) for i in range(4)])
        moved = 0
        for m in dots:
            m.shift(UP * 0.2)
            moved += 1
        ys = [round(float(m.get_center()[1]), 3) for m in dots]
        try:
            dots[99]
            tail = "no-error"
        except IndexError:
            tail = "index-error"
        print("ITER", moved, len(ys), ys[0], tail)
`,
      true,
    )
    expect(text).toContain('ITER 4 4 0.2 index-error')
  }, 60_000)

  it('len(group) 报子物体数；非分组物体抛 TypeError', async () => {
    const { text } = await run(
      `from manim import *


class Demo(Scene):
    def construct(self):
        dots = VGroup(*[Dot() for _ in range(5)])
        try:
            bad = len(Circle())
            tail = "no-error:%d" % bad
        except TypeError:
            tail = "type-error"
        print("LEN", len(dots), tail)
`,
      true,
    )
    expect(text).toContain('LEN 5 type-error')
  }, 60_000)
})

/**
 * 「回调在前」那一族动画：CE 写 `ApplyFunction(func, mobject)`、manim-web 的工厂是
 * `applyFunction(mobject, func)`（Apply*PointwiseFunction / Homotopy 家族 / PhaseFlow 同理）。
 * 参数顺序错了**假画布一点看不出来**——动画只构造、不跑到 `begin()`，于是预检与假画布全绿，
 * 真画布一跑就 `TypeError: e.children is not iterable`（把回调当成了物体）。这里用真场景钉死，
 * 回归表在 `surface.ts` 的 ANIMATION_ARGS。
 */
describe('真画布：回调在前的动画按 manim-web 的参数顺序落地', () => {
  it('ApplyFunction / Pointwise / Homotopy 家族 / PhaseFlow 都跑得完', async () => {
    const { text } = await run(
      `from manim import *


class Demo(Scene):
    def construct(self):
        self.play(ApplyFunction(lambda m: m, Dot()), run_time=0.05)
        self.play(ApplyPointwiseFunction(lambda p: p, Dot()), run_time=0.05)
        self.play(ApplyPointwiseFunctionToCenter(lambda p: p, Dot()), run_time=0.05)
        self.play(ApplyComplexFunction(lambda z: z, Dot()), run_time=0.05)
        self.play(Homotopy(lambda x, y, z, t: [x, y, z], Dot()), run_time=0.05)
        self.play(ComplexHomotopy(lambda z, t: z, Dot()), run_time=0.05)
        self.play(SmoothedVectorizedHomotopy(lambda x, y, z, t: [x, y, z], Dot()), run_time=0.05)
        self.play(PhaseFlow(lambda p: p, Dot()), run_time=0.05)
        print("ARGS ok")
`,
      true,
    )
    expect(text).toContain('ARGS ok')
  }, 60_000)
})

/**
 * 「上了色没有」要能从真物体上读回来：PROP_READS 的 fill_color / stroke_color / fill_opacity。
 * 更重要的是钉死那桩语料事故——manim-web 的 set color 存取器**同时写** strokeColor 与
 * fillColor，而 setStyle({strokeColor}) 内部正是 `this.color = …`：色板先 set_fill 再
 * set_stroke(width=0, color=BLACK)，76 个方块全部被冲成黑色（假画布上样样「正常」）。
 * 修法是描边颜色走 strokeColor 属性写（MethodCall.prop），这里用真物体验证两条通道互不干扰。
 */
describe('真画布：set_fill 与 set_stroke 各走各的通道', () => {
  it('set_fill 之后再 set_stroke，填充色不被冲掉', async () => {
    const { text } = await run(
      `from manim import *


class Demo(Scene):
    def construct(self):
        s = Square(side_length=1).set_fill(RED, opacity=1.0).set_stroke(width=0, color=BLACK)
        print("FILL", s.fill_color, round(float(s.fill_opacity), 2), s.stroke_color)
`,
      true,
    )
    expect(text).toContain('FILL #FC6255 1.0 #000000')
  }, 60_000)

  it('fill_color / stroke_color / fill_opacity 都能读回来', async () => {
    const { text } = await run(
      `from manim import *


class Demo(Scene):
    def construct(self):
        s = Square(side_length=1, fill_color=BLUE, fill_opacity=0.6)
        print("READ", s.fill_color, round(float(s.fill_opacity), 2))
`,
      true,
    )
    expect(text).toContain('READ #58C4DD 0.6')
  }, 60_000)
})
