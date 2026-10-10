/**
 * 截图自查（任务 #56）核出来的**视觉 bug** 的回归网：每条都对应一次「跑通了、画面却不对」。
 *
 * 为什么这些坑假画布抓不到：`manim-bridge.test.ts` / `examples.test.ts` 用的假场景把
 * play / wait 换成空函数，动画**根本跑不到 begin/interpolate/finish**；形状也只在 JS 侧构造、
 * 没人看真几何。于是「颜色被冲掉」「终态落在错的地方」「形状造歪」全部静默通过。
 * 所以这一组一律用真 headless 场景（与 `headless.test.ts` 同一套），并且**读出真数值**来断言。
 *
 * 三个坑（按发现顺序）：
 *  1. `rate_func` 的回程型（`there_and_back`）终态被上游 `finish()` 无视 → 该回起点却停在目标；
 *  2. `.animate.set_fill(BLUE, opacity=0.6)` 的关键字被当尾参对象 → `fill_opacity` 算成 NaN，
 *     动画照跑、画面一点填充都没有；
 *  3. `self.remove(x)` 传的是裸句柄号，通用 method 通道只认 `{__handle}` 标记 → 静默不删。
 *  4. 上游 `ArcBetweenPoints` / `CurvedArrow` 的「两点定弧」算错扫角方向 → 弧到不了终点。
 */
import { describe, expect, it } from 'vitest'
import * as manimModule from 'manim-web'
import { runPython, setPyodideLoader } from './runtime.ts'
import { createManimWebBridge, type ManimNamespace } from './manim-bridge.ts'
import { testPyodideLoader } from '../../../scripts/test-pyodide.mjs'

const manim = manimModule as unknown as ManimNamespace

setPyodideLoader(testPyodideLoader('upstream-fixes'))

// headless 场景带 updater 的 wait 走 requestAnimationFrame，Node 里没有——补一个。
const bag = globalThis as unknown as Record<string, unknown>
bag.requestAnimationFrame ??= (callback: (time: number) => void): number =>
  Number(setTimeout(() => callback(performance.now()), 16))
bag.cancelAnimationFrame ??= (id: number): void => {
  clearTimeout(id)
}

/** 真 headless Scene：不碰 DOM / WebGL，但动画、时间线、updater 都是真的。 */
interface HeadlessScene {
  /** 浏览器构建里是 ReadonlySet、headless 构建里是数组——统一摊开再断言。 */
  mobjects: unknown[] | ReadonlySet<unknown>
}

function headless(): HeadlessScene {
  const Scene = (manimModule as unknown as { Scene: { createHeadless(options?: unknown): object } }).Scene
  return Scene.createHeadless({ width: 1280, height: 720 }) as HeadlessScene
}

/** 场景顶层物体摊成数组（mobjects 在两个构建里一个是 Set、一个是数组）。 */
function topLevel(scene: HeadlessScene): unknown[] {
  return Array.isArray(scene.mobjects) ? scene.mobjects : [...scene.mobjects]
}

/** 跑一段源码，返回 print 出来的文本与**真场景**（要看场景状态的用例取后者）。 */
async function run(code: string, fast = true): Promise<{ text: string; scene: HeadlessScene }> {
  const printed: string[] = []
  const scene = headless()
  await runPython(code, createManimWebBridge({ manim, scene, fast }), {
    output: (text) => printed.push(text),
  })
  return { text: printed.join('\n'), scene }
}

const demo = (body: string): string => `from manim import *


class Demo(Scene):
    def construct(self):
${body}
`

/** 取 print 出来的单个数字行（如 `TAG 3.0`）。 */
function numberLine(text: string, tag: string): number {
  const line = text.split('\n').find((item) => item.startsWith(tag))
  expect(line, `没有拿到 ${tag} 行：\n${text}`).toBeDefined()
  return Number(line!.slice(tag.length).trim())
}

/**
 * 上游 manim-web 的收尾不看 `rateFunc`：`AnimateProxy.finish()`（`.animate` 链）与
 * `Transform.finish()`（经 strategy）都**直接钉到目标态**，把基类 `update()` 里按
 * `interpolate(rateFunc(1))` 摆好的中间态覆盖掉。而 CE 的语义是 `finish()` 调
 * `interpolate(rate_func(1))`——`there_and_back` 的 `rateFunc(1) = 0`，跑完必须**回到起点**。
 * 补法在 `manim-bridge.ts` 的 `settleRateTerminal`：只碰终值 != 1 的速率函数，常规速率一律不动。
 */
describe('真画布：回程型 rate_func 的终态回到起点', () => {
  it('.animate 链 + there_and_back：两种模式都回到原点（修前停在 x=3）', async () => {
    for (const fast of [true, false]) {
      const { text } = await run(
        demo(`        dot = Dot(point=[0, 0, 0], color=RED)
        self.add(dot)
        self.play(dot.animate.shift(RIGHT * 3), rate_func=there_and_back, run_time=0.4)
        print("CENTER", round(float(dot.get_center()[0]), 3))`),
        fast,
      )
      expect(numberLine(text, 'CENTER'), `fast=${fast}`).toBeCloseTo(0, 2)
    }
  }, 60_000)

  it('Transform + there_and_back：也回到起点', async () => {
    const { text } = await run(
      demo(`        square = Square(side_length=1).shift(LEFT * 3)
        self.add(square)
        self.play(Transform(square, square.copy().shift(RIGHT * 2)), rate_func=there_and_back, run_time=0.4)
        print("CENTER", round(float(square.get_center()[0]), 3))`),
    )
    expect(numberLine(text, 'CENTER')).toBeCloseTo(-3, 2)
  }, 60_000)

  it('常规速率（smooth）不受影响：终态仍是目标', async () => {
    const { text } = await run(
      demo(`        square = Square(side_length=1)
        self.add(square)
        self.play(square.animate.shift(RIGHT * 2), run_time=0.4)
        print("CENTER", round(float(square.get_center()[0]), 3))`),
    )
    expect(numberLine(text, 'CENTER')).toBeCloseTo(2, 2)
  }, 60_000)
})

/**
 * manim-web 的 `AnimateProxy` 是一组**写死的 builder**，签名几乎全是位置参数
 * （`setFill(color?, opacity?)`）。把 kwargs 当**尾参对象**塞进去，第二个参数就拿到对象、
 * `fill_opacity` 算成 `NaN`——动画跑通、画面没填充（语料 `animate/02-chain-fill`）。
 * 修法在 `surface.ts` 的 `animateCallArgs`：按签名把关键字摊成位置参数。
 */
describe('真画布：.animate 链的关键字参数落到位置参数上', () => {
  it('set_fill(RED, opacity=1.0)：填充真的上去了（不是 NaN）', async () => {
    const { text } = await run(
      demo(`        square = Square(side_length=1)
        self.add(square)
        self.play(square.animate.set_fill(RED, opacity=1.0), run_time=0.2)
        print("FILL", square.fill_color, round(float(square.fill_opacity), 2))`),
    )
    expect(text).toContain('FILL #FC6255 1.0')
  }, 60_000)

  it('语料那条链式写法：set_fill(BLUE, opacity=0.6).rotate(PI/4)', async () => {
    const { text } = await run(
      demo(`        square = Square(side_length=2)
        self.add(square)
        self.play(square.animate.set_fill(BLUE, opacity=0.6).rotate(PI / 4))
        print("FILL", square.fill_color, round(float(square.fill_opacity), 2))`),
    )
    expect(text).toContain('FILL #58C4DD 0.6')
  }, 60_000)

  it('set_fill_opacity / set_opacity 的关键字也摊开', async () => {
    const { text } = await run(
      demo(`        square = Square(side_length=1)
        self.add(square)
        self.play(square.animate.set_fill_opacity(opacity=0.4), run_time=0.1)
        self.play(square.animate.set_opacity(opacity=0.5), run_time=0.1)
        print("STYLE", round(float(square.fill_opacity), 2), round(float(square.opacity), 2))`),
    )
    // set_opacity 走的是「改写整次调用」那条路：AnimateProxy 有 setOpacity，但物体没有它
    // （只有 opacity 存取器和 setStrokeOpacity），重放会抛在渲染循环里 —— 改写成 setStyle。
    expect(text).toContain('STYLE 0.4 0.5')
  }, 60_000)
})

/**
 * `self.remove(x)` 走的是桥的**通用 method 通道**（`add` 才有专用入口）。那条通道只认
 * `{"__handle": n}` 标记，适配层却把**裸句柄号**传了过来 → manim-web 的 `scene.remove()`
 * 收到一个普通整数，不报错、也不删（语料 `scene/02-remove` 的物体一直留在画面上）。
 */
describe('真画布：self.remove 真的把物体摘掉', () => {
  it('add 两个再 remove 一个，场景只剩一个', async () => {
    const { scene } = await run(
      demo(`        a = Circle(radius=1.5, color=BLUE)
        b = Square(side_length=2, color=YELLOW)
        self.add(a, b)
        self.remove(a)`),
    )
    expect(topLevel(scene)).toHaveLength(1)
  }, 60_000)

  it('语料那条：ReplacementTransform 之后 remove 掉目标，场景空掉', async () => {
    const { scene } = await run(
      demo(`        a = Circle(radius=1.5, color=BLUE)
        b = Square(side_length=2, color=YELLOW)
        self.play(Create(a))
        self.play(ReplacementTransform(a, b))
        self.remove(b)
        self.wait(0.3)`),
    )
    expect(topLevel(scene)).toHaveLength(0)
  }, 60_000)
})

/**
 * `set_stroke(color=…)` 的两个坑都在「描边颜色该写到哪」：
 *  - 走 `color` / `setStyle`：manim-web 的 color 存取器**同时写** fillColor → 有填充的物体被冲黑
 *    （上一轮修过的事故）；
 *  - 只走 `strokeColor`：渲染层 `_syncMaterialToThree` 给描边材质上色读的是 **`_color`**，
 *    `_style.strokeColor` 只是回读通道 → 数据对了、画面纹丝不动（这次截图自查抓到的）。
 * 所以颜色要写两处（`_color` + `strokeColor`），填充通道不受影响。
 */
describe('真画布：set_stroke 的颜色写进渲染真正读的字段', () => {
  it('描边变红且填充不被冲掉（两个通道各读各的）', async () => {
    const { scene } = await run(
      demo(`        circle = Circle(radius=1.4)
        circle.set_stroke(color=RED, width=6)
        self.add(circle)`),
    )
    const circle = topLevel(scene)[0] as { color?: string; strokeColor?: string; fillColor?: string }
    // `_color` 是渲染层的描边来源；`strokeColor` 是回读通道。两个都得是红。
    expect(circle.color).toBe('#FC6255')
    expect(circle.strokeColor).toBe('#FC6255')
    // 填充通道不能被顺带走
    expect(circle.fillColor).not.toBe('#FC6255')
  }, 60_000)

  it('先 set_fill 再 set_stroke(width=0, color=BLACK)：填充保持原色（色板事故的形状）', async () => {
    const { scene } = await run(
      demo(`        square = Square(side_length=1).set_fill(RED, opacity=1.0).set_stroke(width=0, color=BLACK)
        self.add(square)`),
    )
    const square = topLevel(scene)[0] as { color?: string; fillColor?: string }
    expect(square.fillColor).toBe('#FC6255')
    expect(square.color).toBe('#000000')
  }, 60_000)
})

/**
 * 上游 `TransformMatchingTex` / `TransformMatchingShapes` 把「没配上对的片段」的淡入复制品挂到
 * `source.parent` 上，而**顶层物体的 parent 是 null**（场景不是 Mobject）→ 复制品没人收，
 * 画面上凭空少一块（浏览器里 `TransformMatchingTex(MathTex("a","=","b"), MathTex("x","=","y"))`
 * 只剩一个「=」）。修法在 `manim-bridge.ts` 的 `adoptOrphanFadeIns`：play 回来把孤儿收养进场景。
 * TeX 在 Node 里排不了版（没有 DOM），所以这里用形状版钉住同一条修复路径。
 */
describe('真画布：TransformMatching* 没配上对的片段也得出现在场景里', () => {
  it('目标多出的一块要被收养（修前场景只有 1 个顶层物体）', async () => {
    const { scene } = await run(
      demo(`        a = VGroup(Circle(radius=0.8))
        b = VGroup(Square(side_length=1.6), Triangle())
        self.add(a)
        self.play(TransformMatchingShapes(a, b))`),
    )
    // 源 VGroup（在原地变成方块）＋ 收养进来的三角形复制品
    expect(topLevel(scene)).toHaveLength(2)
  }, 60_000)
})

/**
 * 上游 `Matrix._buildMatrix` 把同一个条目**先后 add 进行和列**，而 `Mobject.add` 是**单亲**的
 * ——列把条目从行里偷走，列组又从没挂上矩阵 → 画面只剩括号、内容全空（截图自查抓到的：
 * `Matrix([[1,2],[3,4]])` 墨迹只有括号的 0.2%）。修法在 `manim-bridge.ts` 的
 * `repairMatrixEntries`：构造后把条目还回行里（列组本就不是渲染树的一部分，不用管）。
 */
describe('真画布：Matrix 的条目留在行里', () => {
  it('2×2 矩阵的每行都有 2 个条目、parent 指向行（修前行是空的）', async () => {
    const { scene } = await run(
      demo(`        m = Matrix([[1, 2], [3, 4]])
        self.add(m)`),
    )
    const matrix = topLevel(scene)[0] as { _rows?: unknown }
    const rows = matrix._rows
    expect(Array.isArray(rows), 'Matrix 应暴露 _rows').toBe(true)
    expect(rows as unknown[], '两行').toHaveLength(2)
    for (const row of rows as unknown[]) {
      const children = (row as { children?: unknown[] }).children
      expect(children, '每行 2 个条目').toHaveLength(2)
      for (const entry of children ?? []) {
        expect((entry as { parent?: unknown }).parent, '条目的 parent 是行').toBe(row)
      }
    }
  }, 60_000)

  it('条目本身也真的在矩阵的渲染树里（content → row → entry）', async () => {
    const { scene } = await run(
      demo(`        m = Matrix([[1, 2], [3, 4]])
        self.add(m)`),
    )
    const matrix = topLevel(scene)[0] as {
      children?: Array<{ children?: Array<{ children?: unknown[] }> }>
    }
    // 顶层 children = [content, brackets]；content → 两行 → 各两个条目
    const content = matrix.children?.[0]
    const rows = content?.children ?? []
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.children).toHaveLength(2)
    }
  }, 60_000)
})

/**
 * 上游 `Angle` 的**三点输入**把顺时针角画成优弧：它把参考轴强行翻成 z>0，翻了轴却没翻
 * 测量方向——从第一射线到第二射线量出 `2π − θ`。45° 的夹角画出 315° 的近整圆
 * （截图自查 `ctor/ctor-angle-points` 抓到的：画面是中央一个大圆而不是顶点处的小弧）。
 * 修法与两点定弧同款：surface 的 `angleFromPoints` 算对起始角/带符号扫角，桥侧用 `Arc` 重造。
 *
 * 判据用**外接尺寸**：顶点 [1.5,0]、两条射线指向 180° 与 116.57°、radius 0.5 ⇒ 弧的外接盒
 * 宽 ≈ 0.28（x 跨 [1.0, 1.28]）、高 ≈ 0.45；修前是宽高都 ≈ 1.0 的近整圆。
 */
describe('真画布：Angle 三点定角的弧贴着夹角张开', () => {
  it('顺时针角（顶点在第二点）：宽 ≈ 0.28、高 ≈ 0.45（修前是 1.0 × 1.0 的优弧）', async () => {
    const { text } = await run(
      demo(`        angle = Angle([[0, 0, 0], [1.5, 0, 0], [1, 1, 0]], radius=0.5)
        print("SIZE", round(float(angle.width), 2), round(float(angle.height), 2))`),
    )
    const [width, height] = text
      .split('\n')
      .find((line) => line.startsWith('SIZE'))!
      .slice('SIZE'.length)
      .trim()
      .split(/\s+/)
      .map(Number)
    // 弧从 180° 扫到 116.57°（顺时针 63.43°）：x 跨 [1.5−0.5, 1.5−0.5·cos63.43°] = 宽 0.28，y 跨 [0, 0.45]
    expect(width).toBeGreaterThan(0.24)
    expect(width).toBeLessThan(0.32)
    expect(height).toBeGreaterThan(0.4)
    expect(height).toBeLessThan(0.5)
  }, 60_000)

  it('逆时针角不受影响（上游本来就对，重造后也一致）', async () => {
    const { text } = await run(
      demo(`        angle = Angle([[1.5, 0, 0], [0, 0, 0], [0, 1, 0]], radius=0.5)
        print("SIZE", round(float(angle.width), 2), round(float(angle.height), 2))`),
    )
    const [width, height] = text
      .split('\n')
      .find((line) => line.startsWith('SIZE'))!
      .slice('SIZE'.length)
      .trim()
      .split(/\s+/)
      .map(Number)
    // 顶点在原点、两条射线是 0° 与 90°：四分之一圆的外接盒就是 0.5 × 0.5
    expect(width).toBeCloseTo(0.5, 1)
    expect(height).toBeCloseTo(0.5, 1)
  }, 60_000)

  it('两条线的形式不走重造（上游两线形式没这个病，行为不变）', async () => {
    const { text } = await run(
      demo(`        l1 = Line([0, 0, 0], [2, 0, 0])
        l2 = Line([0, 0, 0], [0, 2, 0])
        angle = Angle(l1, l2, radius=0.4)
        print("SIZE", round(float(angle.width), 2), round(float(angle.height), 2))`),
    )
    const [width, height] = text
      .split('\n')
      .find((line) => line.startsWith('SIZE'))!
      .slice('SIZE'.length)
      .trim()
      .split(/\s+/)
      .map(Number)
    expect(width).toBeCloseTo(0.4, 1)
    expect(height).toBeCloseTo(0.4, 1)
  }, 60_000)
})

/**
 * 上游 manim-web 0.3.24 的「两点定弧」在两个类里各抄了一遍、**都算错扫角方向**：
 * 为了让正角的弧朝上鼓把法线取反了，却没把扫角一起取反 → 圆心在弦下方、扫角仍是正的，
 * 弧从起点绕 180° 落到另一个点，**根本到不了终点**（只有 `|angle| = π` 时碰巧对）。
 * 适配层改用 `Arc` 按 `arcBetweenPoints` 算好的参数重造（见 surface.ts 的 ARC_SHAPE_REPAIRS）。
 *
 * 判据用**外接尺寸**：弦长 4、正角朝上鼓 ⇒ 宽的应是 4、高的是矢高。修前是反过来的（宽 0.83、高 4）。
 */
describe('真画布：两点定弧的起终点真的落在给定两点上', () => {
  it('ArcBetweenPoints(-2,0)→(2,0), angle=PI/2：宽 4、高 ≈ 矢高 0.83', async () => {
    const { text } = await run(
      demo(`        arc = ArcBetweenPoints([-2, 0, 0], [2, 0, 0], angle=PI / 2)
        print("SIZE", round(float(arc.width), 2), round(float(arc.height), 2))`),
    )
    const [width, height] = text
      .split('\n')
      .find((line) => line.startsWith('SIZE'))!
      .slice('SIZE'.length)
      .trim()
      .split(/\s+/)
      .map(Number)
    expect(width).toBeCloseTo(4, 1)
    // 弦半长 2、张角 90° ⇒ R = 2/sin45° = 2.828，矢高 = R - R·cos45° = 0.828
    expect(height).toBeCloseTo(0.83, 1)
  }, 60_000)

  it('CurvedArrow(LEFT*2)→(RIGHT*2), angle=PI/3：宽 4、高 ≈ 矢高 0.54', async () => {
    const { text } = await run(
      demo(`        arrow = CurvedArrow(start_point=LEFT * 2, end_point=RIGHT * 2, angle=PI / 3, color=TEAL)
        print("SIZE", round(float(arrow.width), 2), round(float(arrow.height), 2))`),
    )
    const [width, height] = text
      .split('\n')
      .find((line) => line.startsWith('SIZE'))!
      .slice('SIZE'.length)
      .trim()
      .split(/\s+/)
      .map(Number)
    // 弦半长 2、张角 60° ⇒ R = 2/sin30° = 4，矢高 = 4 - 4·cos30° = 0.536。
    // 末端箭头会顺着切线再伸出去一点（上游 CurvedArrow 会先把杆缩短再装箭头，我们直接用
    // `Arc.addTip`，所以箭头略微越过终点）——给 0.4 的余量，钉的是「量级对、方向对」。
    expect(width).toBeGreaterThan(3.8)
    expect(width).toBeLessThan(4.4)
    expect(height).toBeGreaterThan(0.3)
    expect(height).toBeLessThan(0.75)
  }, 60_000)

  it('竖直弦与负角也按同一套算：弦长 2、矢高 ≈ 0.41', async () => {
    // 竖直弦 (0,-1)→(0,1)：弦长 2、张角 90° ⇒ R = 1/sin45° = 1.414，矢高 = 1.414 - 1 = 0.414。
    // 尺寸不会因为「弧鼓向哪一侧」而变，所以这条同时钉住「起终点真的落在给定两点上」。
    for (const [start, end, angle] of [
      ['[0, -1, 0]', '[0, 1, 0]', 'PI / 2'],
      ['[-1, 0, 0]', '[1, 0, 0]', '-PI / 2'],
    ]) {
      const { text } = await run(
        demo(`        arc = ArcBetweenPoints(${start}, ${end}, angle=${angle})
        print("SIZE", round(float(arc.width), 2), round(float(arc.height), 2))`),
      )
      const [width, height] = text
        .split('\n')
        .find((line) => line.startsWith('SIZE'))!
        .slice('SIZE'.length)
        .trim()
        .split(/\s+/)
        .map(Number)
      // 修前这一对会算成「宽 2、高 2」（绕 180° 落在另一个点上），矢高对就说明终点对了。
      const [long1, long2] = [Math.max(width, height), Math.min(width, height)]
      expect(long1, `${start}→${end}`).toBeCloseTo(2, 1)
      expect(long2, `${start}→${end}`).toBeCloseTo(0.41, 1)
    }
  }, 90_000)
})
