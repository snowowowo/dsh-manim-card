import { describe, expect, it } from 'vitest'
import { PyRunCancelled, PyRuntimeError, packageFailureMessage, runPython, setPyodideLoader } from './runtime.ts'
import { GROUP_KEY, HANDLE_KEY, createRecordingBridge, type ManimBridge } from './bridge.ts'
import { createDryRunBridge } from './dry-run-bridge.ts'
import { testPyodideLoader } from '../../../scripts/test-pyodide.mjs'

// 运行时指向随包的 assets/pyodide（与 Host 生产路径一致，不走网络）。
// 装载细节（临时缓存目录 + 先铺随包 wheel，两条理由）见 scripts/test-pyodide.mjs。
setPyodideLoader(testPyodideLoader('runtime'))

/** 动画位置参数里的对象带 `__handle` 标记——裸数字会被当成角度/坐标（Rotate(c, PI) 就这么踩过）。 */
const ref = (handle: number) => ({ [HANDLE_KEY]: handle })

/** 组动画的位置参数是一串动画，用 `__animations` 标记（普通参数里也有数组，不能靠「是不是数组」分）。 */
const group = (animations: unknown[]) => ({ [GROUP_KEY]: animations })

/** 跑一段 Manim 代码（带 Scene 驱动）并收集 print 输出。 */
async function run(code: string, bridge: ManimBridge = createRecordingBridge()): Promise<string> {
  let out = ''
  await runPython(code, bridge, { output: (text) => { out += text } })
  return out
}

/** 跑一段纯 Python 片段（不找 Scene 子类）。 */
async function runPlain(code: string): Promise<string> {
  let out = ''
  await runPython(code, createRecordingBridge(), { output: (text) => { out += text }, drive: false })
  return out
}

describe('runPython：语法覆盖面', () => {
  // 这批正是上一版手写转译器逐条拒绝掉的写法。换运行时后它们必须一次通过——
  // 这是「不再一点一点补语法」的回归线，任何一条红都说明运行时被换错或配置退化。
  const cases: [string, string, string][] = [
    ['元组解包赋值', 'a, b = 1, 2\nprint(a + b)', '3'],
    ['下标赋值（嵌套列表）', 'p = [[0, 0]]\np[0][0] = 5\nprint(p[0][0])', '5'],
    ['字典当可变状态', 's = {"t": 0.0}\ns["t"] = 2.5\nprint(s["t"])', '2.5'],
    ['嵌套 def 里 return', 'def f(t):\n    return t * 2\nprint(f(3))', '6'],
    ['参数解包 *args', 'def f(*a, **k):\n    return len(a) + len(k)\nprint(f(1, 2, x=3))', '3'],
    ['切片', 'print([1, 2, 3, 4][1:3])', '[2, 3]'],
    ['del 清空', 'b = [1, 2]\ndel b[:]\nprint(len(b))', '0'],
    ['f-string', 'x = 2\nprint(f"{x:.2f}")', '2.00'],
    ['列表推导 + 条件', 'print([i for i in range(6) if i % 2 == 0])', '[0, 2, 4]'],
    ['类与方法', 'class A:\n    def __init__(self):\n        self.n = 0\n    def bump(self):\n        self.n += 1\n        return self\na = A()\na.bump().bump()\nprint(a.n)', '2'],
    // 真 numpy（随包的 wheel）：这条盯住 np.* 惯用法没被换运行时换坏
    ['numpy（np.pi / np.sin / np.linspace）', 'import numpy as np\nprint(len(np.linspace(0, 1, 5)), round(np.sin(np.pi / 2), 3))', '5 1.0'],
  ]

  for (const [label, code, expected] of cases) {
    it(label, async () => {
      expect((await runPlain(code)).trim()).toBe(expected)
    })
  }
})

describe('runPython：manim 适配层', () => {
  it('from manim import * 能构造物体并跑 add / play / wait', async () => {
    const bridge = createRecordingBridge()
    await run(`
from manim import *

class Demo(Scene):
    def construct(self):
        c = Circle(radius=1, color=BLUE)
        self.add(c)
        self.play(Create(c))
        self.wait(0.5)
`, bridge)

    expect(bridge.ops.map((op) => op.op)).toEqual(['create', 'create', 'add', 'play', 'wait'])

    const sceneOp = bridge.ops[0]
    expect(sceneOp.op === 'create' && sceneOp.kind).toBe('Scene')

    const circle = bridge.ops[1]
    expect(circle.op === 'create' && circle.kind).toBe('Circle')
    expect(circle.op === 'create' && circle.kwargs).toEqual({ radius: 1, color: '#58C4DD' })

    const add = bridge.ops[2]
    expect(add.op === 'add' && add.mobjects).toEqual([circle.op === 'create' ? circle.handle : -1])

    const play = bridge.ops[3]
    expect(play.op === 'play' && play.animations).toEqual([
      { kind: 'Create', targets: [ref(circle.op === 'create' ? circle.handle : -1)], kwargs: {} },
    ])

    const wait = bridge.ops[4]
    expect(wait.op === 'wait' && wait.duration).toBe(0.5)
  })

  it('Mobject 作参数时带句柄标记，而不是被当成数字', async () => {
    const bridge = createRecordingBridge()
    await run(`
from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        c.move_to([2.0, 3.0])
`, bridge)
    const moved = bridge.ops.find((op) => op.op === 'method')
    expect(moved?.op === 'method' && moved.args).toEqual([[2.0, 3.0]])
  })

  it('只写 construct 体也收（自动套上 Scene 外壳）', async () => {
    const bridge = createRecordingBridge()
    await run('c = Circle(radius=1)\nself.add(c)\n', bridge)
    expect(bridge.ops.map((op) => op.op)).toEqual(['create', 'create', 'add'])
  })

  it('只写 class 外壳、漏了 import 也能跑（补上 from manim import *）', async () => {
    const bridge = createRecordingBridge()
    await run('class Demo(Scene):\n    def construct(self):\n        c = Circle(radius=1)\n        self.add(c)\n', bridge)
    expect(bridge.ops.map((op) => op.op)).toEqual(['create', 'create', 'add'])
  })

  it('裸 construct 体报错时，行号是用户视角（已扣掉外壳）', async () => {
    const error = await run('c = Circle(radius=1)\nnot_defined\n').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PyRuntimeError)
    expect((error as PyRuntimeError).line).toBe(2)
  })

  it('play 是异步的：Python 会等它播完再往下走', async () => {
    const events: string[] = []
    const bridge: ManimBridge = {
      create: (kind) => { events.push(`new:${kind}`); return 1 },
      method: () => ({ __handle: 1 }),
      getAttr: () => ({ __handle: 1 }),
      add: () => {},
      play: async () => {
        events.push('play:start')
        await new Promise((resolve) => setTimeout(resolve, 1))
        events.push('play:end')
      },
      wait: async () => { events.push('wait') },
    }
    await run(`
from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        self.play(Create(c))
        self.wait(0.2)
`, bridge)
    expect(events).toEqual(['new:Scene', 'new:Circle', 'play:start', 'play:end', 'wait'])
  })
})

// 这批取自真实会话轨迹里失败过的写法（18 次失败中占比最大的几类），
// 每一条红都说明某个「AI 常写、但被适配层/向量类型挡住」的写法又退化了。
describe('runPython：轨迹回归', () => {
  it('多参动画 Transform(a, b) 收下两个目标', async () => {
    const bridge = createRecordingBridge()
    await run(`
from manim import *
class Demo(Scene):
    def construct(self):
        a = Circle(radius=1)
        b = Circle(radius=2)
        self.play(Transform(a, b))
`, bridge)
    const play = bridge.ops.find((op) => op.op === 'play')
    const circles = bridge.ops.flatMap((op) => (op.op === 'create' && op.kind === 'Circle' ? [op.handle] : []))
    expect(play?.op === 'play' && play.animations).toEqual([
      { kind: 'Transform', targets: circles.map(ref), kwargs: {} },
    ])
    expect(circles).toHaveLength(2)
  })

  it('组动画 AnimationGroup 收一串动画', async () => {
    const bridge = createRecordingBridge()
    await run(`
from manim import *
class Demo(Scene):
    def construct(self):
        a = Circle(radius=1)
        b = Square(side_length=1)
        self.play(AnimationGroup([Create(a), FadeIn(b)]))
`, bridge)
    const play = bridge.ops.find((op) => op.op === 'play')
    const [circle, square] = bridge.ops.flatMap((op) => (op.op === 'create' && op.kind !== 'Scene' ? [op.handle] : []))
    expect(play?.op === 'play' && play.animations).toEqual([
      {
        kind: 'AnimationGroup',
        targets: [
          group([
            { kind: 'Create', targets: [ref(circle)], kwargs: {} },
            { kind: 'FadeIn', targets: [ref(square)], kwargs: {} },
          ]),
        ],
        kwargs: {},
      },
    ])
  })

  it('方向常量是向量：UP * 0.2 / RIGHT * 2 逐元素算', async () => {
    const out = await runPlain('from manim import *\nprint((UP * 0.2).tolist(), (RIGHT * 2).tolist())')
    expect(out.trim()).toBe('[0.0, 0.2, 0.0] [2.0, 0.0, 0.0]')
  })

  it('Mobject 支持向量运算（copy 后位移，不改原对象）', async () => {
    const bridge = createRecordingBridge()
    await run(`
from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        moved = c + UP * 2
        self.add(moved)
`, bridge)
    const methods = bridge.ops.filter((op) => op.op === 'method').map((op) => op.op === 'method' && op.name)
    // copy → shift（不 mutate 原对象，所以是 copy 后 shift）
    expect(methods).toEqual(['copy', 'shift'])
  })

  it('VMobject 可构造并自画路径', async () => {
    const bridge = createRecordingBridge()
    await run(`
from manim import *
class Demo(Scene):
    def construct(self):
        vm = VMobject(color=YELLOW, stroke_width=4)
        vm.set_points_as_corners([[0, 0, 0], [1, 1, 0]])
        self.add(vm)
`, bridge)
    const created = bridge.ops.find((op) => op.op === 'create' && op.kind === 'VMobject')
    expect(created?.op === 'create' && created.kind).toBe('VMobject')
  })

  // 下面两条取自最后一次真实会话：self.play(x.animate.set_value(...)) 与裸 Mobject() 各撞一次。
  it('m.animate 链：攒成一次动画交给 play（方法名换 camelCase）', async () => {
    const bridge = createRecordingBridge()
    await run(`
from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        self.play(c.animate.shift(UP).set_color(RED))
`, bridge)
    const play = bridge.ops.find((op) => op.op === 'play')
    const circle = bridge.ops.find((op) => op.op === 'create' && op.kind === 'Circle')
    const handle = circle?.op === 'create' ? circle.handle : -1
    expect(play?.op === 'play' && play.animations).toEqual([
      {
        kind: 'animate',
        targets: [ref(handle)],
        kwargs: {},
        calls: [
          { name: 'shift', args: [[0.0, 1.0, 0.0]], kwargs: {} },
          { name: 'setColor', args: ['#FC6255'], kwargs: {} },
        ],
      },
    ])
  })

  it('m.animate.set_value 换写成 manim-web 的 animateTo（ValueTracker 的值动画）', async () => {
    const bridge = createRecordingBridge()
    await run(`
from manim import *
class Demo(Scene):
    def construct(self):
        t = ValueTracker(0)
        self.play(t.animate.set_value(2))
`, bridge)
    const play = bridge.ops.find((op) => op.op === 'play')
    const tracker = bridge.ops.find((op) => op.op === 'create' && op.kind === 'ValueTracker')
    const handle = tracker?.op === 'create' ? tracker.handle : -1
    expect(play?.op === 'play' && play.animations).toEqual([
      {
        kind: 'animate',
        targets: [ref(handle)],
        kwargs: {},
        calls: [{ name: 'animateTo', args: [2], kwargs: {} }],
      },
    ])
  })

  it('animate 链里 manim-web 没有的方法当场报错，并列出可用方法', async () => {
    const error = await run(`
from manim import *
class Demo(Scene):
    def construct(self):
        c = Circle(radius=1)
        self.play(c.animate.set_fill_color(BLUE))
`).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PyRuntimeError)
    expect(String(error)).toContain('set_fill_color')
    expect(String(error)).toContain('shift')
  })

  it('裸 Mobject() 能构造（挂 updater 当动画驱动器）', async () => {
    const bridge = createRecordingBridge()
    await run(`
from manim import *
class Demo(Scene):
    def construct(self):
        driver = Mobject()
        self.add(driver)
`, bridge)
    const created = bridge.ops.find((op) => op.op === 'create' && op.kind === 'Mobject')
    expect(created?.op === 'create' && created.kind).toBe('Mobject')
  })
})

describe('runPython：错误回报', () => {
  it('运行错误带行号（供 Host 预检回给模型）', async () => {
    const error = await runPlain('a = 1\nb = 2\nc = not_defined\n').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PyRuntimeError)
    expect((error as PyRuntimeError).line).toBe(3)
  })

  it('语法错误也是 PyRuntimeError', async () => {
    const error = await runPlain('def f(:\n    pass\n').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PyRuntimeError)
  })
})

/**
 * 随包只带 numpy + sympy，其余库按 import 按需取（浏览器侧靠 Host 的缓存代理）。
 * 这里钉两件事：随包的库真的能直接用；以及**取包扫描不会把 `manim` 当包名**——
 * 那行 `from manim import *` 每段场景都有，误判会让所有场景卡在取包阶段。
 */
describe('按 import 准备运行时要用的库', () => {
  it('随包的 sympy 直接可用', async () => {
    const out = await runPlain('from sympy import symbols, diff\nx = symbols("x")\nprint(diff(x ** 2, x))')
    expect(out.trim()).toBe('2*x')
  })

  it('from manim import * 与标准库不会被当成待下载的包', async () => {
    const out = await runPlain('from manim import *\nimport math\nfrom manim import Scene\nprint(math.gcd(12, 18))')
    expect(out.trim()).toBe('6')
  })
})

/**
 * 取包失败时回的是哪句话。Pyodide 的失败不走 reject、只走 errorCallback，
 * 且消息是成对的英文行（实测原样抄在这里）——文案从这两行里拼出来，
 * 拼错了用户只会看到 `ModuleNotFoundError`，读不出「首次要联网」这层信息。
 */
describe('packageFailureMessage：把取包失败说成人话', () => {
  it('从标题行扣出包名、从原因行取出原因', () => {
    const message = packageFailureMessage([
      'The following error occurred while loading scipy:',
      'TypeError: Failed to fetch',
      'The following error occurred while loading openblas:',
      'TypeError: Failed to fetch',
    ])
    expect(message).toContain('scipy、openblas')
    expect(message).toContain('TypeError: Failed to fetch')
    expect(message).toContain('联网')
  })

  it('认不出包名时也说得下去', () => {
    const message = packageFailureMessage(['network is down'])
    expect(message).toContain('network is down')
    expect(message).not.toContain('（')
  })
})

/**
 * VGroup 的遍历与越界下标——**预检那条路**（Host 工具调用走的就是空桥）也必须收得了尾。
 *
 * 这是同一个真机事故的另一半：真桥修好了只算一半，预检桥若对任何下标都返句柄，
 * 用户写一句再普通不过的 `for m in group:` 就能把 Host 的工具调用挂死（内存吃满）。
 * 契约与真桥一致：迭代按子物体数收尾，越界下标抛 IndexError。
 */
describe('VGroup：遍历收尾、len 报子物体数、越界抛 IndexError（与真桥同判）', () => {
  const CODE = `from manim import *

g = VGroup(Dot(), Dot(), Dot())
n = 0
for m in g:
    n += 1
ys = [m.get_center()[1] for m in g]
try:
    g[99]
    print("iter", n, len(ys), len(g), "no-error")
except IndexError:
    print("iter", n, len(ys), len(g), "index-error")
`

  it('空桥（createRecordingBridge）', async () => {
    expect((await runPlain(CODE)).trim()).toBe('iter 3 3 3 index-error')
  })

  it('预检桥（createDryRunBridge）同判——数字也要一样', async () => {
    const out: string[] = []
    await runPython(CODE, createDryRunBridge(), { output: (text) => { out.push(text) }, drive: false })
    expect(out.join('').trim()).toBe('iter 3 3 3 index-error')
  })
})

/**
 * 第五轮补的两处适配层行为：
 *  - get_parts()：manim-web 的 getParts 挂在单段上、不在 MathTex 本体上，所以按段迭代出来；
 *    调用它必须走通（拿到列表），而不是转发到一个不存在的方法上（那会报「无对应方法」）。
 *  - 抽象基类（Polyhedron）：名字在 manim-web 里有、但构造即抛内部错误——按「用一下即抛」的
 *    存根处理，报错要能看懂并给出替代类，不能把 this._createGeometry is not a function 抛出去。
 */
describe('适配层：get_parts 与抽象基类存根', () => {
  it('get_parts() 走通并拿到列表（非分段物体则报错，与 CE 同类）', async () => {
    const code = `from manim import *

g = VGroup(Dot(), Dot(), Dot())
parts = g.get_parts()
ok = type(parts).__name__ == "list" and len(parts) == 3
try:
    Circle().get_parts()
    raised = False
except (TypeError, IndexError):
    raised = True
print("parts", ok, raised)
`
    expect((await runPlain(code)).trim()).toBe('parts True True')
  })

  it('Polyhedron 是抽象基类：当场抛可读错并给出具体替代', async () => {
    const code = `from manim import *

try:
    Polyhedron()
    print("no-error")
except NotImplementedError as error:
    print("abstract", "Polyhedron" in str(error), "Cube" in str(error))
`
    expect((await runPlain(code)).trim()).toBe('abstract True True')
  })
})

/**
 * 全页一条队列：一个页面只有一份解释器、一套全局变量（`_dsh_bridge` / `_dsh_src` / 输出落点），
 * 而适配层的 play / wait / create 是**每次调用现取**这些全局的。
 *
 * 为什么必须有这条：两张聊天卡片同屏时各起一块画布、各跑一段代码，await 动画期间解释器是让出去的——
 * 后进的那段把桥顶掉，前一段后半程的动作就全打到别人的画布上（两张卡的内容挤在一块、另一块看着像没渲染），
 * 或者打到一张没有对应句柄的表上当场报错。这正是「同屏两张卡就乱、报错一会儿又没了」的根。
 */
describe('runPython：全页一条队列', () => {
  /** 把「谁在什么时候播了」按顺序记下来；带上延迟好让并发的另一段能插进来。 */
  function timelineBridge(label: string, timeline: string[], delayMs = 0): ManimBridge {
    const base = createRecordingBridge()
    return {
      ...base,
      async play(handle, animations, kwargs) {
        timeline.push(`${label}:play`)
        if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
        return base.play(handle, animations, kwargs)
      },
    }
  }

  const scene = (plays: string): string => `from manim import *

class Demo(Scene):
    def construct(self):
${plays}
`

  it('两段并发提交时不交错：前一段整段跑完，后一段才进解释器', async () => {
    const timeline: string[] = []
    const first = runPython(scene('        self.play(Create(Circle()))\n        self.play(Create(Square()))'),
      timelineBridge('A', timeline, 40), { output: () => {} })
    const second = runPython(scene('        self.play(Create(Dot()))'),
      timelineBridge('B', timeline), { output: () => {} })
    await Promise.all([first, second])

    // A 的两段连着、B 的在其后。没有队列时会是 A、B、A（B 插进 A 的两次 play 之间）
    expect(timeline).toEqual(['A:play', 'A:play', 'B:play'])
  })

  it('轮到它时调用方已经拆了的活儿：整段丢弃、不碰解释器，也不挡住后面的', async () => {
    let out = ''
    const dropped = runPython('print("不该跑")', createRecordingBridge(), {
      output: (text) => { out += text },
      active: () => false,
    })
    await expect(dropped).rejects.toBeInstanceOf(PyRunCancelled)
    expect(out).toBe('')

    // 队首那条作废了，后面排队的照跑（不然一张滚走的卡能堵住整页）
    expect((await run('print("该跑")')).trim()).toBe('该跑')
  })

  it('作废判定在拿到队位之后：前一段还在跑时提交的活儿，等轮到自己再问一次', async () => {
    const timeline: string[] = []
    const slow = timelineBridge('A', timeline, 40)
    const first = runPython(scene('        self.play(Create(Circle()))'), slow, { output: () => {} })
    let alive = true
    const second = runPython(scene('        self.play(Create(Dot()))'), timelineBridge('B', timeline), {
      output: () => {},
      active: () => alive,
    })
    alive = false // 排队期间「画布被拆了」
    await expect(second).rejects.toBeInstanceOf(PyRunCancelled)
    await first
    expect(timeline).toEqual(['A:play'])
  })
})
