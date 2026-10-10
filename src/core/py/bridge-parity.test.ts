/**
 * 对拍测试：同一份输入，预检桥与真桥必须给出**同一个裁决**（都过 / 都拒）。
 *
 * 这是「支持面 SSOT」的核心承诺——两边的判定都从 surface.ts 取。以前两边各写一套，
 * 于是出现「预检放行、真桥报错」：用户看到的是一张出错的卡片。这里把那些用例钉住。
 */
import { describe, expect, it } from 'vitest'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as manimModule from 'manim-web'
import { createDryRunBridge } from './dry-run-bridge.ts'
import { createManimWebBridge, type ManimNamespace } from './manim-bridge.ts'
import { HANDLE_KEY, type ManimBridge } from './bridge.ts'
import { runPython, setPyodideLoader } from './runtime.ts'

// 与 runtime.test.ts / examples.test.ts 同口径：用随包的 assets/pyodide，不走网络。
const pyodideDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets', 'pyodide')
setPyodideLoader(async () => {
  const { loadPyodide } = await import(pathToFileURL(join(pyodideDir, 'pyodide.mjs')).href)
  return loadPyodide({ indexURL: pyodideDir })
})

const manim = manimModule as unknown as ManimNamespace

/** 动画位置参数里的对象带 `__handle` 标记——适配层就是这么发的（裸数字会被当成角度/坐标）。 */
const ref = (handle: number) => ({ [HANDLE_KEY]: handle })

/** 真桥要一块画布（真 Scene 要 DOM/WebGL）；这里只关心它「收不收」，给个记录用的假画布。 */
const fakeScene = () => ({
  add: () => {},
  play: async () => {},
  wait: async () => {},
})

/** 一对桥 + 各自空间里的一个物体（句柄各自独立，各用各的）。 */
function pair(kind = 'Circle'): { dry: ManimBridge; real: ManimBridge; h: [number, number] } {
  const dry = createDryRunBridge()
  const real = createManimWebBridge({ manim, scene: fakeScene() })
  return { dry, real, h: [dry.create(kind, [], {}), real.create(kind, [], {})] }
}

/** 同一动作在两个桥上分别跑，返回「是否抛」的一对。 */
async function verdicts(
  run: (bridge: ManimBridge, handle: number) => unknown,
  kind = 'Circle',
): Promise<[boolean, boolean]> {
  const { dry, real, h } = pair(kind)
  const verdict = async (bridge: ManimBridge, handle: number): Promise<boolean> => {
    try {
      await run(bridge, handle)
      return false
    } catch {
      return true
    }
  }
  return [await verdict(dry, h[0]), await verdict(real, h[1])]
}

const sameVerdict = (both: [boolean, boolean]) => expect(both[1]).toBe(both[0])

describe('预检桥 ↔ 真桥：同判', () => {
  it('表里实测缺失的方法：两边都拒', async () => {
    sameVerdict(await verdicts((bridge, handle) => bridge.method(handle, 'always_redraw', [], {})))
  })

  it('未登记类传位置参数（构造规则会拒）：两边都拒', async () => {
    sameVerdict(await verdicts((bridge) => bridge.create('Mobject', [1], {})))
  })

  it('表里 ok 的类：两边都过', async () => {
    sameVerdict(await verdicts((bridge) => bridge.create('Square', [], { sideLength: 1 })))
  })

  it('表里 ok 的动画：两边都过', async () => {
    sameVerdict(
      await verdicts((bridge, handle) => bridge.play(0, [{ kind: 'Create', targets: [ref(handle)], kwargs: {} }], {})),
    )
  })

  it('animate 链里白名单外的方法：两边都拒', async () => {
    sameVerdict(
      await verdicts((bridge, handle) =>
        bridge.play(0, [{ kind: 'animate', targets: [ref(handle)], kwargs: {}, calls: [{ name: 'setValue', args: [2], kwargs: {} }] }], {}),
      ),
    )
  })

  it('animate 链里白名单内的方法：两边都过', async () => {
    sameVerdict(
      await verdicts((bridge, handle) =>
        bridge.play(0, [{ kind: 'animate', targets: [ref(handle)], kwargs: {}, calls: [{ name: 'shift', args: [[0, 1, 0]], kwargs: {} }] }], {}),
      ),
    )
  })

  it('rate_func 写错名：两边都拒（表里没有的速率名不该过预检）', async () => {
    sameVerdict(
      await verdicts((bridge, handle) =>
        bridge.play(0, [{ kind: 'Create', targets: [ref(handle)], kwargs: {} }], { rate_func: 'no_such_rate' }),
      ),
    )
  })

  it('rate_func 用表里的名：两边都过', async () => {
    sameVerdict(
      await verdicts((bridge, handle) =>
        bridge.play(0, [{ kind: 'Create', targets: [ref(handle)], kwargs: {} }], { rate_func: 'smooth' }),
      ),
    )
  })

  it('读未登记的属性：两边都拒（否则 c.width 会静默拿到一个函数）', async () => {
    sameVerdict(await verdicts((bridge, handle) => bridge.getAttr(handle, 'submobjects')))
  })

  it('读登记的属性：两边都过', async () => {
    sameVerdict(await verdicts((bridge, handle) => bridge.getAttr(handle, 'width')))
  })

  // 方法改写（surface.ts 的 METHOD_REWRITES）：判定层翻出可执行调用，两边都该过。
  // 反例就是报障那条——表里 set_stroke 记 ok（camel 猜的 setStroke 只在 6 个子类上有），
  // 预检过、真桥在普通物体的「无对应方法」上炸。
  it('方法改写 set_stroke：两边都过（不再是「预检放行、真桥炸」）', async () => {
    sameVerdict(await verdicts((bridge, handle) => bridge.method(handle, 'set_stroke', [], { opacity: 0.5 })))
  })

  it('方法改写 set_opacity：两边都过（表里曾记 missing，预检会误拒）', async () => {
    sameVerdict(await verdicts((bridge, handle) => bridge.method(handle, 'set_opacity', [0.3], {})))
  })

  it('方法改写 put_start_and_end_on：Line 上两边都过（走 setStart + setEnd 那组）', async () => {
    const both = await verdicts(
      (bridge, handle) => bridge.method(handle, 'put_start_and_end_on', [[0, 0, 0], [1, 0, 0]], {}),
      'Line',
    )
    sameVerdict(both)
    expect(both).toEqual([false, false])
  })

  // 取「值」的方法在预检里必须返对应形状（见 surface.ts 的 METHOD_RETURNS）。
  // 真机事故：预检一律返句柄 → `(ax.c2p(a) + ax.c2p(b)) / 2`、`tracker.get_value() ** 2`
  // 被判成 Mobject 算术错误，模型只好绕开算术重写代码——坏预检把正确的写法带偏了。
  it('c2p / coords_to_point / get_value 的返回值能参与算术：预检不该拒', async () => {
    const dry = createDryRunBridge()
    await expect(
      runPython(
        `from manim import *
import numpy as np

class Demo(Scene):
    def construct(self):
        ax = Axes(x_range=[-1, 3, 1], y_range=[-1, 3, 1])
        p = ax.c2p(1, 1)
        q = ax.c2p(2, 2)
        mid = (p + q) / 2 + DOWN * 0.3
        lab = MathTex("h").move_to(mid)
        tracker = ValueTracker(1.0)
        x = 1 + tracker.get_value()
        Dot([x ** 2, 0, 0])
        Dot(ax.coords_to_point(1, 1))
        Dot(np.array([0, 0, 0]) + ax.c2p(0, 0))
        self.add(lab)
`,
        dry,
      ),
    ).resolves.toBeUndefined()
  })

  it('取中心/端点的返回值也能参与算术：预检不该拒', async () => {
    const dry = createDryRunBridge()
    await expect(
      runPython(
        `from manim import *

class Demo(Scene):
    def construct(self):
        line = Line(start=[-1, 0, 0], end=[1, 0, 0])
        center = (line.get_start() + line.get_end()) / 2
        Dot(center)
        square = Square(side_length=1)
        Dot(square.get_center() + UP * 0.5)
        self.add(line, square)
`,
        dry,
      ),
    ).resolves.toBeUndefined()
  })
})
