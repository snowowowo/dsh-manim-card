/**
 * 一致性测试：三态表（数据）与 plan*（判定）必须对得上。
 *
 * 支持面 SSOT 的两半一旦漂开，就会出现「表里写着支持、真桥却拒」或反之；本文件把这条对应关系锁死。
 * 只断言「抛 / 不抛」与返回结构——不写文案、不写条数快照，免得改措辞或扩表就红。
 */
import { describe, expect, it } from 'vitest'
import { PY_API_MAP } from './api-map.generated.ts'
import {
  planAnimate,
  planAnimation,
  planAnimationOptions,
  planAttrRead,
  planCreate,
  planMethod,
  planPlayOptions,
  PROP_READS,
} from './surface.ts'

const entries = Object.entries(PY_API_MAP)

const pick = (kinds: string[], state: string) =>
  entries.filter(([, entry]) => kinds.includes(entry.kind) && entry.state === state)

/** 只关心「抛没抛」，不关心抛什么话。 */
const throws = (fn: () => unknown): boolean => {
  try {
    fn()
    return false
  } catch {
    return true
  }
}

/** 可调用的 js 名形状——表里给的是真方法名时才算数（描述串如 `set_fill_opacity(x) + …` 不算）。 */
const isCallableName = (text: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text)

/** 构造器必须有输入的类（AngleInput）：空构造当场报错是**正确行为**，一致性测试要豁免。 */
const REQUIRES_INPUT = new Set(['Angle', 'RightAngle'])

describe('支持面一致性：表 ↔ 判定', () => {
  it('class · ok：planCreate 放行（要求输入的类除外，它们空构造应报可读错）', () => {
    const cases = pick(['class'], 'ok')
    for (const [name] of cases) {
      if (REQUIRES_INPUT.has(name)) {
        const error = (() => {
          try {
            planCreate(name, [], {})
            return undefined
          } catch (e) {
            return e as Error
          }
        })()
        expect(error).toBeDefined()
        expect(error?.message).toContain('缺输入')
        continue
      }
      expect(throws(() => planCreate(name, [], {}))).toBe(false)
    }
    expect(cases.length).toBeGreaterThan(0)
  })

  it('class · missing：planCreate 拒', () => {
    const cases = pick(['class'], 'missing')
    for (const [name] of cases) {
      expect(throws(() => planCreate(name, [], {}))).toBe(true)
    }
    expect(cases.length).toBeGreaterThan(0)
  })

  it('anim · ok / missing：planAnimation 照表放行或拒', () => {
    const ok = pick(['anim'], 'ok')
    for (const [name] of ok) {
      expect(throws(() => planAnimation(name, [], {}))).toBe(false)
    }
    const missing = pick(['anim'], 'missing')
    for (const [name] of missing) {
      expect(throws(() => planAnimation(name, [], {}))).toBe(true)
    }
    expect(ok.length + missing.length).toBeGreaterThan(0)
  })

  it('method / scene-method · ok：planMethod 放行，且给出可调用的 camelCase 名', () => {
    const cases = pick(['method', 'scene-method'], 'ok')
    for (const [name] of cases) {
      const plan = planMethod(name, [], {})
      expect(plan.variants.length).toBeGreaterThan(0)
      for (const calls of plan.variants) {
        for (const call of calls) {
          expect(isCallableName(call.js)).toBe(true)
          expect(call.js).not.toContain('_')
        }
      }
    }
    expect(cases.length).toBeGreaterThan(0)
  })

  it('method / scene-method · missing：planMethod 拒', () => {
    const cases = pick(['method', 'scene-method'], 'missing')
    for (const [name] of cases) {
      expect(throws(() => planMethod(name, [], {}))).toBe(true)
    }
    expect(cases.length).toBeGreaterThan(0)
  })

  it('method · alias：放行，且**真翻得出**可调用的 manim-web 调用', () => {
    // `m[i]` / `animate` 由适配层在 Python 侧接住（不走 planMethod），跳过；
    // 其余 alias（set_stroke / put_start_and_end_on / set_opacity 这些改写）必须给出可执行调用——
    // 「放行而翻不出来」正是「预检过、真桥炸」的老病根。
    const cases = pick(['method', 'scene-method'], 'alias').filter(([name]) => isCallableName(name))
    for (const [name] of cases) {
      const plan = planMethod(name, [], {})
      expect(plan.variants.length).toBeGreaterThan(0)
      for (const calls of plan.variants) {
        expect(calls.length).toBeGreaterThan(0)
        for (const call of calls) expect(isCallableName(call.js)).toBe(true)
      }
    }
    expect(cases.length).toBeGreaterThan(0)
  })

  it('方法改写：CE 的通用写法翻成 manim-web 真调用', () => {
    // set_stroke：颜色写**两处**——`_color` 是渲染层描边材质真正读的字段（只写 strokeColor
    // 的话数据变了画面不变，截图自查抓到过）；`strokeColor` 是回读通道，保证读回一致。
    // 而且不能走 setStyle / setColor 的 set color 存取器——那会把 fillColor 一起冲掉
    // （语料事故：色板全黑）；width / opacity 有专属方法。
    const stroke = planMethod('set_stroke', [], { color: '#FC6255', width: 4, opacity: 0.5 })
    expect(stroke.variants[0]).toEqual([
      { js: '_color', args: ['#FC6255'], prop: true },
      { js: 'strokeColor', args: ['#FC6255'], prop: true },
      { js: 'setStrokeWidth', args: [4] },
      { js: 'setStrokeOpacity', args: [0.5] },
    ])

    // set_opacity：manim-web 把不透明度拆成 stroke / fill 两个 setter
    const opacity = planMethod('set_opacity', [0.3], {})
    expect(opacity.variants[0].map((call) => call.js)).toEqual(['setStrokeOpacity', 'setFillOpacity'])

    // put_start_and_end_on：Arrow/Vector 有同名方法，Line 只有 setStart + setEnd——给两组候选，桥挑能落地的
    const ends = planMethod('put_start_and_end_on', [[0, 0, 0], [1, 0, 0]], {})
    expect(ends.variants.map((calls) => calls.map((call) => call.js))).toEqual([
      ['putStartAndEndOn'],
      ['setStart', 'setEnd'],
    ])
  })

  it('animate 链：改写表内的换成 manim-web 名，白名单外的拒', () => {
    // ValueTracker 的值动画在 manim-web 是独立方法 animateTo（不在 AnimateProxy 的 builder 上）
    expect(planAnimate([{ name: 'set_value', args: [], kwargs: {} }])).toEqual([
      { name: 'animateTo', args: [], kwargs: {} },
    ])
    expect(throws(() => planAnimate([{ name: 'set_fill_color', args: [], kwargs: {} }]))).toBe(true)
    expect(throws(() => planAnimate([{ name: 'shift', args: [], kwargs: {} }]))).toBe(false)
  })

  it('表外名字放行：表是探针种子不是全集——没收录的预检不拒', () => {
    // DiceFace 是 manim-web 有、CE 没有的名字，进不了以 CE 为定义域的表。
    // 表外一律放行，否则会误伤「表没收录但 manim-web 其实支持」的写法
    expect(throws(() => planCreate('DiceFace', [], {}))).toBe(false)
  })

  it('构造规则：未登记类传位置参数拒、登记类超个数拒、登记类正常放行', () => {
    expect(throws(() => planCreate('Mobject', [1], {}))).toBe(true)
    expect(throws(() => planCreate('Circle', [1, 2], {}))).toBe(true)
    expect(throws(() => planCreate('Circle', [1], {}))).toBe(false)
  })

  it('leading 构造：位置参数原样在前、选项对象另挂末尾（TracedPath 这类包住一个物体的类）', () => {
    const mob = { __handle: 7 }
    // 与 options 的区别：物体会被塞进选项对象的键里，而这里它是**独立的位置参数**
    expect(planCreate('TracedPath', [mob], { stroke_color: '#FC6255' })).toEqual([
      mob,
      { strokeColor: '#FC6255' },
    ])
    // 没给选项就不塞空对象——manim-web 里 options 是可选的
    expect(planCreate('TracedPath', [mob], {})).toEqual([mob])
    // 超个数照拒：Union 只收两个形状
    expect(throws(() => planCreate('Union', [mob, mob, mob], {}))).toBe(true)
    expect(throws(() => planCreate('Union', [mob, mob], {}))).toBe(false)
  })

  it('rate · ok：planAnimationOptions 放行；missing：拒', () => {
    const ok = pick(['rate'], 'ok')
    for (const [name] of ok) {
      expect(throws(() => planAnimationOptions({ rate_func: name }))).toBe(false)
      expect(throws(() => planPlayOptions({ rate_func: name }))).toBe(false)
    }
    const missing = pick(['rate'], 'missing')
    for (const [name] of missing) {
      expect(throws(() => planAnimationOptions({ rate_func: name }))).toBe(true)
    }
    expect(ok.length).toBeGreaterThan(0)
  })

  it('rate_func 非字符串（自定义函数过不了桥）：当场拒，不是静默失效', () => {
    expect(throws(() => planAnimationOptions({ rate_func: () => 1 }))).toBe(true)
    expect(throws(() => planPlayOptions({ rate_func: 42 }))).toBe(true)
  })

  it('run_time 必须是数字', () => {
    expect(throws(() => planAnimationOptions({ run_time: 'fast' }))).toBe(true)
    expect(throws(() => planPlayOptions({ run_time: 'fast' }))).toBe(true)
    expect(throws(() => planAnimationOptions({ run_time: 2 }))).toBe(false)
  })

  it('动画选项改名：run_time → duration，其余键换 camelCase', () => {
    const options = planAnimationOptions({ run_time: 2, lag_ratio: 0.5 })
    expect(options).toMatchObject({ duration: 2, lagRatio: 0.5 })
  })

  it('属性读取：登记的名字放行，未登记的拒', () => {
    for (const name of Object.keys(PROP_READS)) {
      expect(throws(() => planAttrRead(name))).toBe(false)
    }
    // submobjects 过桥后是裸对象数组、拿不回有用值，刻意不登记
    expect(throws(() => planAttrRead('submobjects'))).toBe(true)
  })

  it('组动画：嵌套动画也照表校验（内层缺失项不该被外层放过）', () => {
    const nested = { __animations: [{ kind: 'always_redraw', targets: [], kwargs: {} }] }
    expect(throws(() => planAnimation('AnimationGroup', [nested], {}))).toBe(true)
  })
})

describe('构造器位置参数映射（签名逐一核对过 manim-web dist/*.d.ts）', () => {
  it('options 模式：位置参数按 keys 落键，rename 换 CE 关键字名', () => {
    expect(planCreate('Vector', [[2, 1, 0]], {})).toEqual([{ direction: [2, 1, 0] }])
    expect(planCreate('ParametricFunction', ['fn'], {})).toEqual([{ func: 'fn' }])
    expect(planCreate('ParametricFunction', [], { function: 'fn', t_range: [0, 1] })).toEqual([
      { func: 'fn', tRange: [0, 1] },
    ])
    expect(planCreate('CurvedArrow', ['s', 'e'], {})).toEqual([{ startPoint: 's', endPoint: 'e' }])
  })

  it('input 模式：两条线打成输入对象；三点数组落 points；输入键进对象、其余进选项', () => {
    const line1 = { line: 1 }
    const line2 = { line: 2 }
    expect(planCreate('RightAngle', [line1, line2], { length: 0.3 })).toEqual([
      { line1, line2 },
      { length: 0.3 },
    ])
    expect(planCreate('RightAngle', [], { line1, line2, length: 0.3 })).toEqual([
      { line1, line2 },
      { length: 0.3 },
    ])
    const three = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
    ]
    expect(planCreate('Angle', [three], {})).toEqual([{ points: three }])
    expect(planCreate('Angle', three, {})).toEqual([{ points: three }])
    expect(throws(() => planCreate('Angle', [three[0], three[1]], {}))).toBe(true)
    expect(throws(() => planCreate('RightAngle', [line1], {}))).toBe(true)
  })

  it('leading 透传普通值；pack 打包；未登记类给可读错', () => {
    expect(planCreate('ValueTracker', [0.5], {})).toEqual([0.5])
    expect(planCreate('CubicBezier', ['a', 'b', 'c', 'd'], {})).toEqual([{ points: ['a', 'b', 'c', 'd'] }])
    expect(planCreate('Brace', ['mob'], { buff: 0.1 })).toEqual(['mob', { buff: 0.1 }])
    expect(throws(() => planCreate('SomeUnknown', ['x'], {}))).toBe(true)
  })

  /**
   * 第五轮补的一批：CE 收位置参数、manim-web 的签名却各有不同。
   * 逐个对着 dist/*.d.ts 核过（在 CTOR 里登记），这里把「位置参数怎么落」钉死。
   */
  it('leading + optKeys：前几个位置参数直传，多出来的落进同一个选项对象', () => {
    // TangentLine(vmobject, t) → new TangentLine(vmobject, { t })
    expect(planCreate('TangentLine', ['c', 0.25], {})).toEqual(['c', { t: 0.25 }])
    // BraceLabel(mobject, label) → new BraceLabel(mobject, { label })
    expect(planCreate('BraceLabel', ['mob', 'a'], {})).toEqual(['mob', { label: 'a' }])
    // 关键字与位置参数并进同一个选项对象；超个数给可读错
    expect(planCreate('TangentLine', ['c', 0.25], { length: 3 })).toEqual(['c', { t: 0.25, length: 3 }])
    expect(throws(() => planCreate('TangentLine', ['c', 0.25, 9], {}))).toBe(true)
    // BraceText 的两个都是位置参数（选项对象排第三）
    expect(planCreate('BraceText', ['mob', 'b'], {})).toEqual(['mob', 'b'])
  })

  it('第五轮登记的形状：位置参数按各自签名落位', () => {
    expect(planCreate('ArcBrace', ['arc'], {})).toEqual([{ arc: 'arc' }])
    expect(planCreate('ConvexHull3D', ['p1', 'p2'], {})).toEqual([{ points: ['p1', 'p2'] }])
    expect(planCreate('Line3D', ['s', 'e'], {})).toEqual([{ start: 's', end: 'e' }])
    expect(planCreate('Arrow3D', ['s', 'e'], {})).toEqual([{ start: 's', end: 'e' }])
    // CE 的 RegularPolygram(5, density=3)：首参是顶点数，manim-web 的键叫 numVertices
    expect(planCreate('RegularPolygram', [7], { density: 3 })).toEqual([{ numVertices: 7, density: 3 }])
    // SingleStringMathTex(latex, options?)：latex 是位置参数
    expect(planCreate('SingleStringMathTex', ['x^2'], {})).toEqual(['x^2'])
    // VDict({"a": mob})：整个 record 就是第一个位置参数
    expect(planCreate('VDict', [{ a: 'm1' }], {})).toEqual([{ a: 'm1' }])
    // Polygram(vertex_groups)：位置参数打包进 vertexGroups
    expect(planCreate('Polygram', [['g1']], {})).toEqual([{ vertexGroups: ['g1'] }])
    // Code(code_string=…) / Variable(label=…)：CE 名换 manim-web 键
    expect(planCreate('Code', [], { code_string: 'x=1' })).toEqual([{ code: 'x=1' }])
    expect(planCreate('Variable', [], { label: 't' })).toEqual([{ label: 't' }])
  })

  it('动画参数改写：ShowPartial 的比例搬进选项、ChangeSpeed 的数字换成速度函数标记', () => {
    const show = planAnimation('ShowPartial', [{ __handle: 1 }, 0.2, 0.8], {})
    expect(show.targets).toEqual([{ __handle: 1 }])
    expect(show.options).toEqual({ startPortion: 0.2, endPortion: 0.8 })

    const speed = planAnimation('ChangeSpeed', [{ __handle: 1 }], { speed_factor: 2 })
    expect(speed.targets?.[0]).toEqual({ __handle: 1 })
    // 数字留在标记里（真函数由桥那侧现造）——选项里不再有 speedFactor
    expect(speed.targets?.[1]).toEqual({ __speedFactor: 2 })
    expect(speed.options).toEqual({})
  })

  it('LaggedStartMap：动画类名换成 manim-web 的导出名；不是动画类就拒', () => {
    const plan = planAnimation('LaggedStartMap', [{ __animClass: 'FadeIn' }, { __handle: 2 }], {})
    // CE 名 FadeIn → manim-web 的导出名 fadeIn（工厂是小写开头）
    expect(plan.targets?.[0]).toEqual({ __animClass: 'fadeIn' })
    expect(plan.targets?.[1]).toEqual({ __handle: 2 })
    // 名字对不上就当场拒，别等桥去取一个不存在的类
    expect(throws(() => planAnimation('LaggedStartMap', [{ __animClass: 'NotAnAnimation' }, { __handle: 2 }], {}))).toBe(true)
  })

  it('嵌套动画：TransformAnimations / ChangeSpeed 里的那份动画也照表校验', () => {
    // 用表里**已知缺失**的动画名当内层：递归校验没做的话这里会放行，真桥才炸
    const nested = { kind: 'MaintainPositionRelativeTo', targets: [], kwargs: {} }
    expect(throws(() => planAnimation('TransformAnimations', [nested, { __handle: 1 }], {}))).toBe(true)
    // 组动画那条路（GROUP_KEY）同样要递归
    expect(throws(() => planAnimation('AnimationGroup', [{ __animations: [nested] }], {}))).toBe(true)
  })
})
