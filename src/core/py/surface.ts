/**
 * 支持面 SSOT：「哪些 Manim 写法被支持」的**数据**与**判定**的唯一定义处。
 *
 * - **数据**：探针实测的三态表（`api-map.generated.ts`）+ 构造参数规则（原在 manim-bridge.ts 里手写）。
 * - **判定**：`plan*` 纯函数。真桥与预检都调它们，所以同一段代码两边**同判**。
 *
 * 「预检放行、真桥报错」这类不一致，根子是同一份判定被写了两遍、而且越写越松；这里只留一份。
 * 本模块不碰 DOM、不碰宿主，也不碰句柄登记（那是真桥的事），因此两端都能引。
 */
import { PY_ANIMATE_METHODS, PY_API_MAP, PY_COLOR_HEX, type PyApiEntry } from './api-map.generated.ts'
import { ANIM_CLASS_KEY, ANIMATE_KIND, GROUP_KEY, SPEED_KEY, type AnimationSpec, type AnimationTarget } from './bridge.ts'

export { PY_ANIMATE_METHODS, PY_API_MAP, PY_COLOR_HEX }
export type { PyApiEntry }

/** snake_case → camelCase（manim-web 的方法名是 camel）。 */
export const camel = (name: string): string =>
  name.replace(/_([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase())

/** 关键字参数整体换 camelCase（OneTwo 这种键名 manim-web 才认）。 */
export const camelKeys = (kwargs: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(kwargs)) out[camel(key)] = value
  return out
}

/**
 * 位置参数口径（依据 node_modules/manim-web 各类构造器实读）：
 *  - options ：只收一个选项对象——位置参数按 keys 顺序落成选项键（Text("hi") → { text: "hi" }）；
 *              rename 把 CE 的关键字名换成 manim-web 的键名（ParametricFunction 的 function→func）
 *  - leading ：先收固定位置参数、再收选项对象（TracedPath(mob, options?)、Brace(mobject, options?)）
 *              带 optKeys 时：超出 keys 的那几个位置参数依次落进**同一个选项对象**的键上
 *              （TangentLine(vmobject, t) → new TangentLine(vmobject, { t })）
 *  - variadic：变长位置参数原样展开（VGroup(c1, c2)）
 *  - pack    ：位置参数打包成数组放进首个键（Polygon(a, b, c) → { vertices: [...] }）
 *  - input   ：位置参数打成**一个输入对象**再收选项对象（Angle/RightAngle：两条线 → { line1, line2 }）
 * 未登记的类不接受位置参数，报错让调用方改用关键字——不臆造键名。
 * `hint` 只用来把「为什么不多收」写进超参报错里（CE 有这个写法、manim-web 形状不同）。
 */
type CtorSpec =
  | {
      mode: 'options'
      keys: string[]
      rename?: Record<string, string>
      hint?: string
      /** 落参前的最后一道：形状对得上、但**内容** manim-web 不认时，当场给可读说法。 */
      guard?: (values: Record<string, unknown>) => void
    }
  | { mode: 'leading'; keys: string[]; optKeys?: string[] }
  | { mode: 'variadic' }
  | { mode: 'pack'; key: string }
  | { mode: 'input'; keys: string[] }

/**
 * CE 的表格会把数字 / 字符串换算成文字，manim-web 的 Table 只要物体——
 * 不换算时它会在渲染里抛 `t.getThreeObject is not a function`（用户完全看不懂）。
 * 在构造前拦下，换成能照着改的话；IntegerTable / DecimalTable / MathTable 本来就收原始值，不拦。
 */
function assertTableCells(values: Record<string, unknown>): void {
  const data = values.data
  if (!Array.isArray(data)) return
  const raw = data.flat().find((cell) => typeof cell === 'number' || typeof cell === 'string')
  if (raw !== undefined) {
    throw new Error(
      `Table 的单元格要用物体（Text / MathTex / DecimalNumber…），收到 ${JSON.stringify(raw)}——` +
        'CE 会把数字换算成文字，manim-web 不换算；纯数字的表用 IntegerTable / DecimalTable',
    )
  }
}

/**
 * manim-web 里**有这个名字**、但它是**抽象基类**：构造即抛内部错误
 * （`Polyhedron()` → `this._createGeometry is not a function`，用户完全看不出该怎么办）。
 *
 * 所以按「缺失」处理：适配层生成一个「用一下即抛、并给出具体替代类」的存根，
 * 技能文档也把它们从「可用清单」挪进「实测缺失」（gen-skill 读的就是这张表）。
 * 与场景家族（有类、只是共用一块画布）不同：那些是能用的，这些是不能直接构造的。
 *
 * ⚠️ 放这儿而不是 manim-shim.ts 里：两边（执行侧与文档生成侧）都读这一份，免得漂。
 */
export const ABSTRACT_CLASSES: Record<string, string> = {
  Polyhedron: '抽象基类，不能直接构造——用具体类：Cube / Sphere / Cone / Cylinder / Torus / Prism / Tetrahedron / Octahedron / Dodecahedron / Icosahedron',
}

const CTOR: Record<string, CtorSpec> = {
  // CE 的字重 / 字形叫 weight / slant，manim-web 的键叫 fontWeight / fontStyle（camel 推不出来）。
  Text: { mode: 'options', keys: ['text'], rename: { weight: 'fontWeight', slant: 'fontStyle' } },
  MarkupText: { mode: 'options', keys: ['text'], rename: { weight: 'fontWeight', slant: 'fontStyle' } },
  Title: { mode: 'options', keys: ['text'], rename: { weight: 'fontWeight', slant: 'fontStyle' } },
  // CE 的 Paragraph(*lines) 是多行；manim-web 的 ParagraphOptions.text 只收**一个字符串**
  // （多行靠 width= 自动折行）。所以不打包——打包会把 string[] 静默喂进去，换成什么都看不出来。
  Paragraph: {
    mode: 'options',
    keys: ['text'],
    hint: 'manim-web 的 Paragraph 只收一个字符串（折行用 width=）——多行请拆成多个 Text 装进 VGroup',
  },
  BulletedList: { mode: 'pack', key: 'items' },
  // CE 的 MathTex(*tex) 是变长位置参数，manim-web 的 latex 收 string | string[]——
  // 打包进同一个键；没有位置参数时（MathTex(latex=[...])）原样走关键字。
  MathTex: { mode: 'pack', key: 'latex' },
  Tex: { mode: 'pack', key: 'latex' },
  Line: { mode: 'options', keys: ['start', 'end'] },
  DashedLine: { mode: 'options', keys: ['start', 'end'] },
  Arrow: { mode: 'options', keys: ['start', 'end'] },
  Dot: { mode: 'options', keys: ['point'] },
  Circle: { mode: 'options', keys: ['radius'] },
  Ellipse: { mode: 'options', keys: ['width', 'height'] },
  Square: { mode: 'options', keys: ['sideLength'] },
  Rectangle: { mode: 'options', keys: ['width', 'height'] },
  Arc: { mode: 'options', keys: ['radius', 'startAngle', 'angle'] },
  Triangle: { mode: 'options', keys: ['vertices'] },
  DecimalNumber: { mode: 'options', keys: ['value'] },
  Integer: { mode: 'options', keys: ['value'] },
  VGroup: { mode: 'variadic' },
  Group: { mode: 'variadic' },
  Polygon: { mode: 'pack', key: 'vertices' },
  Axes: { mode: 'options', keys: ['xRange', 'yRange'] },
  NumberPlane: { mode: 'options', keys: ['xRange', 'yRange'] },
  NumberLine: { mode: 'options', keys: ['xRange'] },
  BarChart: { mode: 'options', keys: ['values'] },
  // 「包住一个/两个物体」的类：manim-web 把这些物体收成**位置参数**，选项对象另起一个参数。
  // 不按 options 收——那样物体会被塞进选项对象的键里，构造器形状对不上（typia 报错）。
  TracedPath: { mode: 'leading', keys: ['trackedMobject'] },
  AnimatedBoundary: { mode: 'leading', keys: ['boundedMobject'] },
  SurroundingRectangle: { mode: 'leading', keys: ['mobject'] },
  BackgroundRectangle: { mode: 'leading', keys: ['mobject'] },
  Cross: { mode: 'leading', keys: ['mobject'] },
  Union: { mode: 'leading', keys: ['shape1', 'shape2'] },
  Difference: { mode: 'leading', keys: ['shape1', 'shape2'] },
  Intersection: { mode: 'leading', keys: ['shape1', 'shape2'] },
  Exclusion: { mode: 'leading', keys: ['shape1', 'shape2'] },
  // 以下逐一核对过 manim-web 的构造器签名（dist/*.d.ts）：
  Vector: { mode: 'options', keys: ['direction'] },
  ParametricFunction: { mode: 'options', keys: ['func'], rename: { function: 'func' } },
  FunctionGraph: { mode: 'options', keys: ['func'], rename: { function: 'func' } },
  ImplicitFunction: { mode: 'options', keys: ['func'], rename: { function: 'func' } },
  ArcBetweenPoints: { mode: 'options', keys: ['start', 'end'] },
  CurvedArrow: { mode: 'options', keys: ['startPoint', 'endPoint'], rename: { start: 'startPoint', end: 'endPoint' } },
  CurvedDoubleArrow: { mode: 'options', keys: ['startPoint', 'endPoint'], rename: { start: 'startPoint', end: 'endPoint' } },
  CubicBezier: { mode: 'pack', key: 'points' },
  ArcPolygon: { mode: 'pack', key: 'vertices' },
  // Angle/RightAngle 的首参是「输入对象」：{ line1, line2 } 或 { points: [三点] }，选项另起一个参数。
  Angle: { mode: 'input', keys: ['line1', 'line2'] },
  RightAngle: { mode: 'input', keys: ['line1', 'line2'] },
  Brace: { mode: 'leading', keys: ['mobject'] },
  BraceBetweenPoints: { mode: 'options', keys: ['start', 'end'] },
  // 构造器第一参是普通值（ValueTracker(0.5)），原样透传。
  ValueTracker: { mode: 'leading', keys: ['value'] },
  ComplexValueTracker: { mode: 'leading', keys: ['value'] },
  // 以下几类 CE 收位置参数、manim-web 收了但形状不同，逐一按 dist/*.d.ts 登记。
  DoubleArrow: { mode: 'options', keys: ['start', 'end'] },
  Underline: { mode: 'leading', keys: ['mobject'] },
  DashedVMobject: { mode: 'options', keys: ['vmobject'] },
  ConvexHull: { mode: 'pack', key: 'points' },
  Matrix: { mode: 'leading', keys: ['data'] },
  IntegerMatrix: { mode: 'leading', keys: ['data'] },
  DecimalMatrix: { mode: 'leading', keys: ['data'] },
  MobjectMatrix: { mode: 'leading', keys: ['data'] },
  // CE 的表首参叫 table（Table(table, row_labels=…, col_labels=…)），manim-web 的键叫 data。
  Table: { mode: 'options', keys: ['data'], rename: { table: 'data' }, guard: assertTableCells },
  MobjectTable: { mode: 'options', keys: ['data'], rename: { table: 'data' }, guard: assertTableCells },
  MathTable: { mode: 'options', keys: ['data'], rename: { table: 'data' } },
  IntegerTable: { mode: 'options', keys: ['data'], rename: { table: 'data' } },
  DecimalTable: { mode: 'options', keys: ['data'], rename: { table: 'data' } },
  // CE 的 Star(n=5) / RegularPolygon(n=6)：manim-web 的键是 numPoints / numSides。
  Star: { mode: 'options', keys: ['numPoints'], rename: { n: 'numPoints' } },
  RegularPolygon: { mode: 'options', keys: ['numSides'], rename: { n: 'numSides' } },
  // ——— 第五轮补齐：表里 ok、但之前「构造姿势没登记」的一批（逐一实读 dist/*.d.ts）。
  // ArcBrace(arc, direction=1, buff=0.2)：manim-web 收 { arc, direction, buff, strokeWidth }。
  ArcBrace: { mode: 'options', keys: ['arc'] },
  // BraceLabel(mobject, label, …)：label 在 manim-web 里是**选项键**（第二参是选项对象）。
  BraceLabel: { mode: 'leading', keys: ['mobject'], optKeys: ['label'] },
  // BraceText(mobject, text, …)：text 是 manim-web 的第二**位置参数**（选项对象排第三）。
  BraceText: { mode: 'leading', keys: ['mobject', 'text'] },
  // TangentLine(vmobject, alpha)：manim-web 收 (vmobject, { t, length })。
  TangentLine: { mode: 'leading', keys: ['vmobject'], optKeys: ['t'] },
  // 以下都是「CE 收位置参数、manim-web 收选项对象」的普通选项类。
  TangentialArc: { mode: 'options', keys: ['start', 'direction'] },
  ConvexHull3D: { mode: 'pack', key: 'points' },
  Line3D: { mode: 'options', keys: ['start', 'end'] },
  Arrow3D: { mode: 'options', keys: ['start', 'end'] },
  // RegularPolygram(5, density=2)：CE 的首参是顶点数，manim-web 的键叫 numVertices。
  RegularPolygram: { mode: 'options', keys: ['numVertices'], rename: { n: 'numVertices' } },
  // 向量场：CE 的 func 是第一参，manim-web 的键叫 func（同 ParametricFunction 的 function→func）。
  VectorField: { mode: 'options', keys: ['func'], rename: { function: 'func' } },
  ArrowVectorField: { mode: 'options', keys: ['func'], rename: { function: 'func' } },
  StreamLines: { mode: 'options', keys: ['func'], rename: { function: 'func' } },
  // SingleStringMathTex(latex, options?)：latex 是位置参数、选项另起一个。
  SingleStringMathTex: { mode: 'leading', keys: ['latex'] },
  // Code(code_string=…)：manim-web 的键叫 code。
  Code: { mode: 'options', keys: ['code'], rename: { code_string: 'code' } },
  // Variable(label=…)：manim-web 的第一参就是选项对象（label 必填）。
  Variable: { mode: 'options', keys: ['label'] },
  // VDict({"a": mob})：manim-web 直接收一个 record——位置参数原样透传。
  VDict: { mode: 'leading', keys: ['items'] },
  // Polygram(vertex_groups=…) / ConvexHull 一族：都收选项对象，位置参数按 pack 打包。
  Polygram: { mode: 'pack', key: 'vertexGroups' },
}

/**
 * 上游 manim-web 造歪了的弧线形状：适配层改用**已验证正确**的 `Arc` 重造。
 *
 * 病根是同一段复制了两遍的「两点定弧」代码（`ArcBetweenPoints._calculateArcParams` 与
 * `CurvedArrow._generatePoints`，manim-web 0.3.24）：它为了「正角时弧朝上鼓」把**法线取反**，
 * 却没同时把**扫角取反**，于是圆心在弦下方、扫角仍是正的 → 弧从起点出发绕 **180°** 落到
 * `center + R·(startAngle+θ)`，**根本到不了终点**。只有 `|angle| = π` 时法线偏移为 0 才碰巧正确。
 *
 * 直测（`scripts/probe-shapes.mjs`，真 manim-web）：
 *  - `ArcBetweenPoints({start:[-1,0,0], end:[1,0,0], angle:PI/2})` 画出的点终点是 `(-1,-2)` 不是 `(1,0)`；
 *  - `CurvedArrow(startPoint=LEFT*2, endPoint=RIGHT*2, angle=PI/3)`（语料 `basic/11`）鼓到 x=-4.87。
 *
 * 修法：不改上游、就地算对圆心/半径/起始角/带符号扫角（`arcBetweenPoints`），再用 `Arc` 造。
 * `Arc` 的这套参数是**直接照用**的（`Arc.copy()` 也照传），所以修完是**可复制**的——不像就地改
 * `ArcBetweenPoints` 的 setter：那样一旦 `copy()`，上游会拿修过的负扫角再走一遍坏公式、又翻回去。
 * 代价是返回的实例类型是 `Arc`（`getStartPoint` / `getEndPoint` 仍在，值也对）。
 */
export interface ArcShapeRepair {
  /** 起点 / 终点在选项对象里的键名（两个类的形状不同）。 */
  startKey: string
  endKey: string
  /** 末端带箭头（CurvedArrow）还是两端都带（CurvedDoubleArrow）。 */
  tip: 'none' | 'end' | 'both'
}

export const ARC_SHAPE_REPAIRS: Record<string, ArcShapeRepair> = {
  ArcBetweenPoints: { startKey: 'start', endKey: 'end', tip: 'none' },
  CurvedArrow: { startKey: 'startPoint', endKey: 'endPoint', tip: 'end' },
  CurvedDoubleArrow: { startKey: 'startPoint', endKey: 'endPoint', tip: 'both' },
}

/** 两点定弧的几何：圆心 / 半径 / 起始角 / **带符号**扫角（正角 → 弧朝弦的左法线一侧鼓）。 */
export interface ArcGeometry {
  center: number[]
  radius: number
  startAngle: number
  /** 有符号：圆心在弦下方时为负——照它扫过去才落在终点上。 */
  sweep: number
}

/**
 * 给定两端点与张角，算出 `Arc` 要的那组参数。
 *
 * 推导：弦半长 `h = |end-start|/2`；张角 `θ` ⇒ 半径 `R = h / sin(θ/2)`；圆心到弦中点的距离
 * `R·cos(θ/2)`，方向沿弦的单位法线。正角取法线**反向**（`sign = -1`），弧就朝上鼓——与上游
 * `CurvedArrow` 的取向一致；扫角同时取 `sign·θ`，终点才会落在 `end` 上（上游漏的就是这一步）。
 */
export function arcBetweenPoints(start: number[], end: number[], angle: number): ArcGeometry {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const half = Math.hypot(dx, dy) / 2
  const theta = Math.abs(angle)
  const midX = (start[0] + end[0]) / 2
  const midY = (start[1] + end[1]) / 2
  if (half < 1e-10 || theta < 1e-10) {
    return { center: [midX, midY, start[2] ?? 0], radius: 0, startAngle: 0, sweep: 0 }
  }
  const radius = half / Math.sin(theta / 2)
  const offset = radius * Math.cos(theta / 2)
  // 弦的单位法线（逆时针转 90°）——半径归一化时不必再除，dx,dy 的长度就是 2·half。
  const sign = angle > 0 ? -1 : 1
  const center = [midX + (sign * offset * -dy) / (2 * half), midY + (sign * offset * dx) / (2 * half), start[2] ?? 0]
  const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0])
  return { center, radius, startAngle, sweep: sign * theta }
}

/**
 * 上游 `Angle` 的**三点输入**把顺时针角画成优弧：它把参考轴强行翻成 z>0（2D 时 `g[2]<0` 就
 * 取反），翻了轴却没翻**测量方向**——于是从第一条射线量到第二条射线得到 `2π − θ`，
 * 45° 的角画出 315° 的近整圆（截图自查 `ctor/ctor-angle-points` 抓到的）。
 *
 * 修法与弧线同款：适配层自己算对，用 `Arc` 重造。默认取**不越过 π 的那一侧**（CE 的
 * `other_angle=False` 语义）；`otherAngle=True` 要优弧，保持出发方向绕远的那条走。
 * 只在 2D（三条射线都贴 XY 平面）时启用——3D 的平面取向另有一套，交给上游。
 */
export function angleFromPoints(
  start: number[],
  vertex: number[],
  end: number[],
  otherAngle = false,
): { center: number[]; startAngle: number; sweep: number } {
  const startAngle = Math.atan2(start[1] - vertex[1], start[0] - vertex[0])
  let sweep = Math.atan2(end[1] - vertex[1], end[0] - vertex[0]) - startAngle
  // 归一到 (-π, π]：这就是三点夹着的不越过半圈的角
  while (sweep <= -Math.PI) sweep += 2 * Math.PI
  while (sweep > Math.PI) sweep -= 2 * Math.PI
  // 优弧：方向不变、绕远的那一圈
  if (otherAngle) sweep += sweep > 0 ? -2 * Math.PI : 2 * Math.PI
  return { center: [vertex[0], vertex[1], vertex[2] ?? 0], startAngle, sweep }
}

/** 三点定角要重造的类（病根见 angleFromPoints；RightAngle 画的是方形记号、没这个病）。 */
export const ANGLE_POINTS_REBUILT: ReadonlySet<string> = new Set(['Angle'])

/**
 * animate 链里「CE 名 → manim-web 代理上的方法名」的改写。
 *
 * manim-web 的 `AnimateProxy` 方法面是**写死的一组 builder**（shift / moveTo / setColor…），
 * 不是动态转发，所以 camel 推不出来的方法就是真的没有。`ValueTracker` 的值动画在
 * manim-web 是**独立方法** `animateTo(target, options)`，只能靠这张表接上。
 */
export const ANIMATE_REWRITES: Record<string, string> = {
  set_value: 'animateTo',
}

/**
 * animate 链里「代理有这个名字、**物体本身却没有**」的坑：改写整次调用。
 *
 * `AnimateProxy.setOpacity` 只是个记名字的 builder（`_calls.push(['setOpacity', [x]])`），
 * 真正生效要在**目标物体**上重放那一串调用；而 manim-web 的 `Mobject` 只有 `opacity`
 * **存取器**和 `setStrokeOpacity()`，**没有 `setOpacity()`** → 重放当场抛
 * `AnimateProxy: method "setOpacity" not found`，而且抛在**渲染循环里**（play 永不 resolve）。
 *
 * 能重放的是 `setStyle`：它认 `strokeOpacity` 键并落到 `_opacity`（见 Mobject.setStyle）。
 * 所以把 `set_opacity(x)` 整次改写成 `set_style(stroke_opacity=x)`。
 */
const ANIMATE_CALL_REWRITES: Record<
  string,
  (args: unknown[], kwargs: Record<string, unknown>) => {
    name: string
    args: unknown[]
    kwargs: Record<string, unknown>
  }
> = {
  // 键用 camel：适配层在 shim 里就把名字 camel 化了（`_AnimateChain._to_spec` 查 `_ANIMATE_METHODS`），
  // 桥拿到的已经是 `setOpacity`，不是 `set_opacity`。
  setOpacity: (args, kwargs) => ({
    name: 'setStyle',
    args: [],
    // setStyle 收一个样式对象，键名的 camel 化由桥统一做
    kwargs: { stroke_opacity: kwargs.opacity !== undefined ? kwargs.opacity : args[0] },
  }),
}

/** animate 链可用方法：探针给的是 snake，两端调用时给的是 camel，两种都收；改写目标也算可用。 */
const ANIMATE_ALLOWED = new Set<string>([
  ...PY_ANIMATE_METHODS,
  ...PY_ANIMATE_METHODS.map(camel),
  ...Object.values(ANIMATE_REWRITES),
])

/**
 * animate 链 builder 的**位置参数签名**：每个槽位列出「CE 侧可能用的关键字名」（已 camel 化）。
 *
 * 为什么单开一张表：manim-web 的 `AnimateProxy` 是一组**写死的 builder**，签名几乎全是**位置参数**
 * （`setFill(color?, opacity?)`，见 core/AnimateProxy.d.ts），没有「末位收一个选项对象」的约定。
 * 而调用侧的习惯是把 kwargs 当**尾参对象**塞进去，于是 `set_fill(BLUE, opacity=0.6)` 变成
 * `setFill('#58C4DD', {opacity: 0.6})`——第二个参数拿到对象，`fill_opacity` 算成 `NaN`：
 * 动画照跑、画面却一点填充都没有（语料 `animate/02-chain-fill` 正是这条，肉眼才发现）。
 * 所以这里按签名把关键字**摊成位置参数**再调用。
 *
 * 表外的 builder 分两类，都维持「kwargs 当末位对象」：收一个**选项/样式对象**的
 * （`setStyle(style)`）、以及改写出来的 `animateTo(target, options)`——它们的对象语义本来就对。
 */
const ANIMATE_SIGNATURE: Record<string, string[][]> = {
  shift: [['delta', 'vector']],
  moveTo: [['target', 'point'], ['alignedEdge']],
  rotate: [['angle'], ['axisOrOptions', 'axis']],
  scale: [['factor', 'scaleFactor']],
  setColor: [['color']],
  // setOpacity 不在这里：它被 ANIMATE_CALL_REWRITES 整次改写成 setStyle，走不到签名表。
  setStrokeWidth: [['width']],
  setFillOpacity: [['opacity']],
  setFill: [['color', 'fillColor'], ['opacity']],
  flip: [['axis']],
  nextTo: [['target', 'mobject'], ['direction'], ['buff']],
  alignTo: [['target', 'mobject'], ['direction']],
  toEdge: [['direction', 'edge'], ['buff']],
  setX: [['x']],
  setY: [['y']],
  setZ: [['z']],
  withDuration: [['seconds', 'duration']],
  withRateFunc: [['fn', 'func', 'rateFunc']],
}

/**
 * 把一次 animate 链调用的位置参数与关键字参数合成**最终位置参数列表**（见 ANIMATE_SIGNATURE）。
 *
 * 关键字能对上签名槽位就落到那个位置（中间缺的补 undefined）；对不上槽位的（拼错名、或表外方法的对象）
 * 仍按老规矩并成一个尾参对象——宁可原样透传让 manim-web 自己报，也不静默丢掉。
 */
export function animateCallArgs(
  name: string,
  positional: unknown[],
  kwargs: Record<string, unknown>,
): unknown[] {
  const signature = ANIMATE_SIGNATURE[name]
  if (signature === undefined) {
    return Object.keys(kwargs).length > 0 ? [...positional, kwargs] : positional
  }
  const out = [...positional]
  const leftover: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(kwargs)) {
    const slot = signature.findIndex((names) => names.includes(key))
    // 槽位对上了但该位置已有实参（同时给位置与关键字）→ 不覆盖，退回尾参对象保留信息
    if (slot < 0 || (slot < out.length && out[slot] !== undefined)) {
      leftover[key] = value
      continue
    }
    while (out.length < slot) out.push(undefined)
    out[slot] = value
  }
  return Object.keys(leftover).length > 0 ? [...out, leftover] : out
}

/**
 * 属性读取表：CE 里「读属性」的写法 → manim-web 的取法。
 *
 * 适配层的 `__getattr__` 对任何名字都返回一个「调用包装」，所以 `c.width` 拿到的是个函数
 * （静默错，最难查）。这几个是 CE 代码里读得最多的属性，逐个走真取法。
 *  - method：manim-web 是方法（`getWidth()`）
 *  - attr  ：manim-web 是存取器（`color`）
 * 只登记**跨端能拿回有用值**的：`submobjects` 返回的是裸对象数组（过桥后不可用）故不登记。
 *
 * `length` 是给适配层的 `__len__` 用的（`len(group)` / `len(mathtex)`）：manim-web 的 VGroup
 * 有 `get length()` 存取器，MathTex 继承 VGroup 也有；别的物体读出来是 undefined，适配层的
 * int(None) 会抛 TypeError——与 CE「Circle 没有 len()」同类。这一项与下标取值（INDEX_GETTERS）
 * 是同一件事的两面：都问「这个物体有几个子物体」。
 */
export const PROP_READS: Record<string, { method?: string; attr?: string }> = {
  width: { method: 'getWidth' },
  height: { method: 'getHeight' },
  center: { method: 'getCenter' },
  color: { attr: 'color' },
  opacity: { attr: 'opacity' },
  points: { attr: 'points' },
  length: { attr: 'length' },
  // CE 的 fill_color / stroke_color：manim-web 是 fillColor / strokeColor 存取器。
  // 「上了色没有」要能从 Python 里读回来——预期表现与视觉自查都靠它。
  fill_color: { attr: 'fillColor' },
  stroke_color: { attr: 'strokeColor' },
  fill_opacity: { attr: 'fillOpacity' },
  // CE 的 `m.target`：`m.generate_target()` 之后读它改「目标版」——manim-web 的字段叫 targetCopy。
  // 读出来是个**对象**（走句柄），所以下面能接着 `.shift()`；MoveToTarget(m) 要看的就是这个字段。
  target: { attr: 'targetCopy' },
}

/**
 * `m[i]` 取子物体：按顺序试这几种真取法（MathTex 是 `getPart(i)`、VGroup 是 `get(i)`）。
 * 顺序由支持面定，适配层照此生成取法列表——别在 Python 里另写一份。
 */
export const INDEX_GETTERS: string[] = ['getPart', 'get']

/**
 * 取**值**的方法返回值是什么——预检桥照此返一个占位值（真桥返的是真值，不用这张表）。
 *
 * 为什么必须有：预检桥对一切方法都返句柄，于是返回值是个 Mobject，而真桥返的却是
 * 向量 / 数值。**合法算术在预检里被误判**——真机事故：`ax.c2p(...)` 与 `tracker.get_value()`
 * 拿去做 `(p + q) / 2`、`x ** 2`，预检报 `unsupported operand type(s) ... 'Mobject' and 'int'`，
 * 模型只好绕开算术重写（连试三次），代码反而被一个坏预检带偏。
 *
 * 真桥那头由 manim-web 的实际返回值决定（数值数组 → `_wrap` 转向量、数值 → 原样），
 * 两边形状对齐才不会「预检拒、真桥过」。
 */
export const METHOD_RETURNS: Record<string, 'vector' | 'number'> = {
  // 坐标类：返回数值数组（manim-web 返回 [x, y, z]）
  c2p: 'vector',
  coords_to_point: 'vector',
  get_center: 'vector',
  get_start: 'vector',
  get_end: 'vector',
  get_bounding_box: 'vector',
  input_to_graph_point: 'vector',
  // 数值类
  get_value: 'number',
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/**
 * 表里**实测缺失**的写法：当场拒绝，并把替代写法一并说清。
 * 表外名字一律放行——表只收录探针种子，直接拒绝会误伤「没收录但 manim-web 其实支持」的写法。
 */
function assertSupported(name: string): void {
  const entry = PY_API_MAP[name]
  if (entry?.state === 'missing') {
    throw new Error(`${name} 在 manim-web 无对应——${entry.alt ?? '查支持速查表'}`)
  }
}

/** 按 spec 的 rename 把 CE 关键字名换成 manim-web 的键名（在 camelCase 之前做）。 */
function renameKw(
  kwargs: Record<string, unknown>,
  rename: Record<string, string> | undefined,
): Record<string, unknown> {
  if (rename === undefined) return kwargs
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(kwargs)) out[rename[key] ?? key] = value
  return out
}

/** 物体构造：按构造规则表把位置参数落成 manim-web 收的形状，或抛可读错。返回构造器实参列表。 */
export function planCreate(kind: string, args: unknown[], kwargs: Record<string, unknown>): unknown[] {
  assertSupported(kind)
  const spec = CTOR[kind]
  const kw = camelKeys(spec === undefined ? kwargs : renameKw(kwargs, spec.mode === 'options' ? spec.rename : undefined))
  const hasKw = Object.keys(kw).length > 0
  if (spec === undefined) {
    if (args.length > 0) {
      throw new Error(
        `${kind} 的位置参数暂不支持——试试关键字形式（参数名照 Manim 文档），或改用已支持的写法`,
      )
    }
    return [kw]
  }
  if (spec.mode === 'variadic') return [...args, ...(hasKw ? [kw] : [])]
  if (spec.mode === 'pack') {
    const packed = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
    // 没有位置参数时全走关键字（MathTex(latex=[...])）——别拿空数组把关键字盖掉
    if (packed.length === 0) return [kw]
    return [{ ...kw, [spec.key]: packed }]
  }
  // input：位置参数打成「输入对象」（Angle(line1, line2) → { line1, line2 }；传三点数组则
  // 落成 { points: [...] }），关键字里的输入键并入同一个对象，其余关键字留给选项对象。
  if (spec.mode === 'input') {
    const input: Record<string, unknown> = {}
    const rest: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(kw)) {
      ;(spec.keys.includes(key) || key === 'points' ? input : rest)[key] = value
    }
    if (args.length > 0) {
      if (args.every((arg) => Array.isArray(arg))) {
        // Angle([[p1, p2, p3]]) 与 Angle(p1, p2, p3) 都收——前者要多剥一层
        input.points = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
      } else if (args.length === spec.keys.length) {
        spec.keys.forEach((key, index) => { input[key] = args[index] })
      } else {
        throw new Error(
          `${kind} 位置参数收两条线（或三个坐标点），收到 ${args.length} 个——或用关键字 ${spec.keys.join('=..., ')}=...`,
        )
      }
    }
    if (Array.isArray(input.points) && input.points.length !== 3) {
      throw new Error(`${kind} 的坐标点要三个（起点、顶点、终点），收到 ${input.points.length} 个`)
    }
    if (Object.keys(input).length === 0) throw new Error(`${kind} 缺输入——传两条线或关键字 ${spec.keys.join('=..., ')}=...`)
    return [input, ...(Object.keys(rest).length > 0 ? [rest] : [])]
  }
  // leading：位置参数原样在前、选项对象另起一个参数挂末尾（TracedPath(mob, { strokeColor })）——
  // 与 options 的区别就在这：options 把位置参数并进**同一个**选项对象里。
  // optKeys 接「前几个直传、再往后落进选项对象」的签名（TangentLine(vmobject, t) →
  // new TangentLine(vmobject, { t })）：不这样，第二个位置参数会被当成选项对象本身，
  // typia 报的错与真实原因完全对不上。
  if (spec.mode === 'leading') {
    const optKeys = spec.optKeys ?? []
    const lead = args.slice(0, spec.keys.length)
    const rest = args.slice(spec.keys.length)
    if (rest.length > optKeys.length) {
      throw new Error(
        `${kind} 位置参数最多 ${spec.keys.length + optKeys.length} 个（依次是 ${[...spec.keys, ...optKeys].join(', ')}）`,
      )
    }
    const opts: Record<string, unknown> = { ...kw }
    optKeys.forEach((key, index) => {
      if (index < rest.length) opts[key] = rest[index]
    })
    return [...lead, ...(Object.keys(opts).length > 0 ? [opts] : [])]
  }
  if (args.length > spec.keys.length) {
    const hint = spec.hint
    throw new Error(
      `${kind} 位置参数最多 ${spec.keys.length} 个（依次是 ${spec.keys.join(', ')}）` +
        (hint === undefined ? '' : `——${hint}`),
    )
  }
  const entries: Record<string, unknown> = {}
  spec.keys.forEach((key, index) => {
    if (index < args.length) entries[key] = args[index]
  })
  const merged = { ...entries, ...kw }
  spec.guard?.(merged)
  return [merged]
}

/**
 * 速率函数的解析结果：manim-web 的导出名 + 是否要先无参调一次。
 * manim-web 有一批速率是柯里化工厂（`runningStart()` 才返回真函数），照直传会拿到一个函数工厂。
 */
export interface RatePlan {
  js: string
  curried: boolean
}

/**
 * 「点数对齐」型动画：manim-web 里这几支的 `begin()` 会**直接调 `alignVmobjectPair`**
 * （或经 `PointMorphStrategy`），而且**没有兜底**——两端点数对不齐就 `throw`，抛在**渲染循环里**
 * （play 永不 resolve、页面一直转）。实测（Node 真场景，manim-web 0.3.24）：
 * `Transform(Arrow, Star)`、`ReplacementTransform(Arrow, Star)`、`ClockwiseTransform(VGroup(3), VGroup(1))`
 * 都抛 `alignVmobjectPair: alignPoints fallback produced mismatched point counts`。
 *
 * 它们**不是「不可用」，而是「挑输入」**，所以不能按名字一刀切，要按实际那一对判。判法两条：
 *  - `vgroupSafe`：两端都是 `VGroup` 时这支是否就安全。实测 `Transform` / `ReplacementTransform`
 *    对 VGroup 对走的是「按子物配对」（`_beginVGroup`）、根本不看点数；而 `FadeTransform` /
 *    `ClockwiseTransform` 那几支照样直接对点数，所以对 VGroup 对也不安全。
 *  - 其余情况由桥拿**复制品试跑一次 `begin()`**（对得齐就用真动画、保住 morph，对不齐退兜底）。
 *    但只对**不需要异步排版**的物体这么做——MathTex/Tex/Text 这类「构造即发起排版」的物体，
 *    复制品会各自再排一次版，在 Node（无 DOM）里必然失败成未处理拒绝（污染测试、退出码非零）。
 *    这类物体复制不安全，就直接按保守侧走兜底。
 */
export const POINT_MORPH_ANIMATIONS: Record<string, { vgroupSafe: boolean }> = {
  Transform: { vgroupSafe: true },
  ReplacementTransform: { vgroupSafe: true },
  TransformFromCopy: { vgroupSafe: true },
  FadeTransform: { vgroupSafe: false },
  FadeTransformPieces: { vgroupSafe: false },
  ClockwiseTransform: { vgroupSafe: false },
  CounterclockwiseTransform: { vgroupSafe: false },
}

/**
 * 「CE 的位置参数形状与 manim-web 工厂不同」的动画。
 *
 * 表外的（`Rotate(mob, PI/4)` / `MoveAlongPath(mob, path)` / `GrowFromEdge(mob, LEFT)` …）
 * 不用管：manim-web 那批 camelCase 工厂本身就是 CE 形状。只有这几个反着来或要收选项。
 */
const ANIMATION_ARGS: Record<
  string,
  (targets: AnimationTarget[], options: Record<string, unknown>) => AnimationTarget[]
> = {
  // CE `ApplyMatrix(matrix, mobject)`；manim-web 的工厂是 `applyMatrix(mobject, matrix)`。
  ApplyMatrix: (targets) => [targets[1], targets[0]],
  // CE `ChangeDecimalToValue(decimal, target_value)`；manim-web 收 `{ targetValue }`。
  ChangeDecimalToValue: (targets, options) => {
    options.targetValue = targets[1]
    return [targets[0]]
  },
  // CE `CyclicReplace(a, b, …)` 是变长位置参数；manim-web 的工厂收**一个数组**
  // （`cyclicReplace(mobjects, options?)`，见 animation/transform/MovementTransforms.d.ts）。
  // 不包数组的话，第二个物体被当成 options——typia 在它的 shift 字段上报错，完全看不出根因。
  CyclicReplace: (targets) => [targets],
  // CE 把**回调放在第一位**（`ApplyFunction(func, mobject)` / `Homotopy(func, mobject)`），
  // manim-web 的工厂反过来（`applyFunction(mobject, func)`，见 dist/animation/transform、
  // movement/Homotopy）。不换序的话回调被当物体、物体被当回调——**假画布看不出来**（动画只构造、
  // 不跑到 begin），真画布一跑就是 `e.children is not iterable`。
  ApplyFunction: (targets) => [targets[1], targets[0]],
  ApplyComplexFunction: (targets) => [targets[1], targets[0]],
  ApplyPointwiseFunction: (targets) => [targets[1], targets[0]],
  ApplyPointwiseFunctionToCenter: (targets) => [targets[1], targets[0]],
  Homotopy: (targets) => [targets[1], targets[0]],
  ComplexHomotopy: (targets) => [targets[1], targets[0]],
  SmoothedVectorizedHomotopy: (targets) => [targets[1], targets[0]],
  PhaseFlow: (targets) => [targets[1], targets[0]],
  // CE `ShowPartial(mob, start, end)` 收两个**位置**比例；manim-web 收选项 `{ startPortion, endPortion }`。
  // 不搬进选项对象的话，第二个比例会被当成选项对象本身——typia 报的错与真实原因对不上。
  ShowPartial: (targets, options) => {
    if (targets[1] !== undefined) options.startPortion = targets[1]
    if (targets[2] !== undefined) options.endPortion = targets[2]
    return [targets[0]]
  },
  // CE `ChangeSpeed(animation, speed_factor=2)` 收一个**数字**；manim-web 的 changeSpeed 要一个
  // 速度**函数**（`(t) => number`）。函数没法从 Python 侧造好过桥，所以把数字标记成
  // { __speedFactor: n }，由桥在那一侧换成 `() => n`——与 rate_func 的 RatePlan 同一套路。
  ChangeSpeed: (targets, options) => {
    const factor = options.speedFactor ?? 1
    delete options.speedFactor
    return [targets[0], { [SPEED_KEY]: factor }]
  },
}

/** 一次动画的解析结果：调谁、怎么调、传什么选项。 */
export interface AnimationPlan {
  /** manim-web 的调用目标名（工厂函数名或类名）。 */
  js: string
  /** factory = 直接调（CE 形状）；new = 类构造（只有基类 Animation 没有工厂）。 */
  call: 'factory' | 'new'
  /** 已 camelCase 的 manim-web 选项；`rateFunc` 位置放的是 RatePlan（由桥解析成真函数）。 */
  options: Record<string, unknown>
  /** 判定改写过的位置参数（顺序对调 / 参数挪进选项）；缺省 = 原样用 spec.targets。 */
  targets?: AnimationTarget[]
  /** 该动画属「点数对齐」型（见 POINT_MORPH_ANIMATIONS）——桥要按实际那一对预判能不能 morph。 */
  pointMorph?: { vgroupSafe: boolean }
}

/**
 * `rate_func=` 的值：适配层给的是**速率名**（CE 名，如 `smooth` / `there_and_back`）。
 *
 * 为什么不是对象标记：Pyodide 的 dict_converter 会把 kwargs 里嵌的字典吞成空对象
 * （实测 `{"__rate": "smooth"}` 过桥变成 `{}`），字符串没这个问题。
 * 校验放在判定里（而不是桥里）——预检与真桥取同一份，否则又会出现「预检放过、真桥才炸」。
 * 传自定义函数（CE 允许 lambda）在这里被拒：Python 函数过不了桥，宁可当场说清楚。
 */
function planRate(value: unknown): RatePlan {
  const entry = typeof value === 'string' ? PY_API_MAP[value] : undefined
  if (entry?.kind !== 'rate' || entry.state !== 'ok' || entry.js === undefined) {
    throw new Error(
      typeof value === 'string'
        ? `rate_func 不认识 ${value}——只支持表里的速率名（smooth / linear / there_and_back …）`
        : 'rate_func 要传速率函数名（如 smooth / linear / there_and_back）——自定义速率函数不支持',
    )
  }
  return { js: entry.js, curried: entry.curried === true }
}

/**
 * 动画选项：CE 的 kwargs → manim-web 的 options。
 * `run_time` 是 CE 的名字（manim-web 叫 duration）、`rate_func` 要解析成真函数；
 * 其余（`shift` / `scale` / `lag_ratio` / `path_arc`…）名字同形，换成 camelCase 直传。
 */
export function planAnimationOptions(kwargs: Record<string, unknown>): Record<string, unknown> {
  const options: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(kwargs)) {
    if (key === 'run_time') {
      if (typeof value !== 'number') throw new Error('run_time 要传数字（秒）')
      options.duration = value
      continue
    }
    if (key === 'rate_func') {
      options.rateFunc = planRate(value)
      continue
    }
    options[camel(key)] = value
  }
  return options
}

/**
 * 动画校验：查表 + **递归校验组动画里的嵌套动画**，并解析出调用目标与选项。
 * animate 链（ANIMATE_KIND）不在这里判，由 planAnimate 负责。
 */
export function planAnimation(
  kind: string,
  targets: AnimationTarget[],
  kwargs: Record<string, unknown>,
): AnimationPlan {
  if (kind === ANIMATE_KIND) return { js: ANIMATE_KIND, call: 'new', options: {} }
  assertSupported(kind)
  for (const target of targets) {
    // 嵌套动画：组动画是一串 spec（GROUP_KEY），而 TransformAnimations / ChangeSpeed 这类
    // 直接把一个动画当位置参数（就是一份 spec）——两种都要递归校验，否则里层写得不对要到
    // 真桥构造时才炸。
    if (isNestedSpec(target)) planAnimation(target.kind, target.targets, target.kwargs)
    else if (target !== null && typeof target === 'object' && GROUP_KEY in target) {
      for (const nested of (target as { [GROUP_KEY]: AnimationSpec[] })[GROUP_KEY]) {
        planAnimation(nested.kind, nested.targets, nested.kwargs)
      }
    }
  }
  const entry = PY_API_MAP[kind]
  const js = entry?.js !== undefined && IDENTIFIER.test(entry.js) ? entry.js : kind
  const options = planAnimationOptions(kwargs)
  const call = entry?.call === 'new' ? 'new' : 'factory'
  const morph = POINT_MORPH_ANIMATIONS[kind]
  const extra = morph === undefined ? {} : { pointMorph: morph }
  const reorder = ANIMATION_ARGS[kind]
  if (reorder !== undefined) {
    return { js, call, options, ...extra, targets: mapAnimClass(reorder(targets, options)) }
  }
  const mapped = mapAnimClass(targets)
  return mapped === targets ? { js, call, options, ...extra } : { js, call, options, ...extra, targets: mapped }
}

/** 把位置参数里夹着的「动画类名标记」换成 manim-web 的导出名；没夹着的原样返回（同引用）。 */
function mapAnimClass(targets: AnimationTarget[]): AnimationTarget[] {
  let changed = false
  const out = targets.map((target) => {
    if (Array.isArray(target)) {
      const inner = mapAnimClass(target as AnimationTarget[])
      if (inner !== target) changed = true
      return inner
    }
    if (target !== null && typeof target === 'object' && ANIM_CLASS_KEY in target) {
      changed = true
      return { [ANIM_CLASS_KEY]: resolveAnimClass(String((target as Record<string, unknown>)[ANIM_CLASS_KEY])) }
    }
    return target
  })
  return changed ? out : targets
}

/**
 * 位置参数里直接放了一整份**动画**（`TransformAnimations(anim1, anim2)` /
 * `ChangeSpeed(Create(c), …)`）——按结构认，不另加标记：句柄标记有 `__handle`、
 * 组标记有 `__animations`，两者都不占 `kind`/`targets`/`kwargs` 这三个键。
 */
function isNestedSpec(value: unknown): value is AnimationSpec {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const bag = value as Record<string, unknown>
  return typeof bag.kind === 'string' && Array.isArray(bag.targets) && typeof bag.kwargs === 'object'
}

/**
 * `LaggedStartMap(FadeIn, group)` 那类：位置参数里夹着「动画类的名字」。
 * 适配层给的是 CE 名，这里换成 manim-web 的导出名——桥只能按导出名取真类。
 */
function resolveAnimClass(name: string): string {
  const entry = PY_API_MAP[name]
  if (entry === undefined || entry.js === undefined || !IDENTIFIER.test(entry.js)) {
    throw new Error(`${name} 不是可用的动画类——LaggedStartMap 的第一参要传动画类（如 FadeIn / Create）`)
  }
  return entry.js
}

/** scene.play 的选项：CE 的 `run_time` / `rate_func`（逐动画的选项走 planAnimation）。 */
export interface PlayPlan {
  /** play 级时长（秒）；给出时覆盖每段动画并封顶。 */
  duration?: number
  /** play 级速率；给出时覆盖每段动画的速率。 */
  rate?: RatePlan
}

export function planPlayOptions(kwargs: Record<string, unknown>): PlayPlan {
  const plan: PlayPlan = {}
  if (kwargs.run_time !== undefined) {
    if (typeof kwargs.run_time !== 'number') throw new Error('run_time 要传数字（秒）')
    plan.duration = kwargs.run_time
  }
  if (kwargs.rate_func !== undefined) plan.rate = planRate(kwargs.rate_func)
  return plan
}

/** 属性读取：只放行 PROP_READS 登记过的名字，给出真取法。 */
export function planAttrRead(name: string): { jsName: string; via: 'method' | 'attr' } {
  const spec = PROP_READS[name]
  if (spec === undefined) throw new Error(`不支持读属性 ${name}——用对应的 get_* 方法`)
  return spec.method !== undefined
    ? { jsName: spec.method, via: 'method' }
    : { jsName: spec.attr as string, via: 'attr' }
}

/** 一次 manim-web 调用：方法名 + 实参。`prop` 表示**属性写**（`target[js] = args[0]`）——
 * manim-web 的一些通道只有存取器没有方法（`strokeColor`），而它的 `setColor` / `setStyle`
 * 会连带把填充一起改掉（set color 同时写 strokeColor 与 fillColor），不能拿来当描边色用。 */
export interface MethodCall {
  js: string
  args: unknown[]
  prop?: true
}

/**
 * CE 方法 → manim-web 的**调用候选**（按顺序试，第一组「接收者上真有这些方法」的生效）。
 *
 * 为什么手写：探针能测出「manim-web 有没有 `setStroke`」，测不出「CE 的 `set_stroke` 该落到
 * manim-web 的哪个方法上」——那是语义判断，与 CTOR 同类，属人工残留，和判定放在一处。
 *
 * 为什么是**候选组**而不是单个名字：同一个 CE 方法在不同子类上对应不同写法
 * （`put_start_and_end_on`：Arrow/Vector 有 `putStartAndEndOn`，Line 只有 `setStart` + `setEnd`）。
 * 前一组在接收者上不全在就试下一组；都不在，桥报可读错。
 *
 * ⚠️ 只收「manim-web 有等价能力、一两次调用拼得出来」的。拼不出来的（`surround` / `plot_*`）
 * 仍记 missing，由预检当场拒并给改法——**不能只是放行**：放行而没真翻译，就会回到
 * 「预检过、真桥走到不存在的 setStroke 上才炸」那类晚报错。
 */
const METHOD_REWRITES: Record<
  string,
  (args: unknown[], kwargs: Record<string, unknown>) => MethodCall[][]
> = {
  // CE `set_stroke(color=None, width=None, opacity=None, background=False, family=True)`
  // ⚠️ 颜色**不能**走 setStyle / setColor：manim-web 的 set color 存取器同时写 strokeColor
  // 与 fillColor（dist core/Mobject：`this._style.strokeColor = e, this._style.fillColor = e`），
  // setStyle 内部正是 `this.color = e.strokeColor`——「只改描边」会把填充一起冲掉
  // （语料事故：色板先 set_fill 再 set_stroke(width=0, color=BLACK)，76 个方块全黑）。
  //
  // ⚠️ 但**只**写 strokeColor 也不行：渲染层 `_syncMaterialToThree` 给描边材质上色用的是
  // `this.color`（即 `_color` 字段），`_style.strokeColor` 只是 getter 的回读通道——
  // 写了它描边材质纹丝不动（截图自查抓到的：`method/01-set-stroke` 数据是 #FC6255、画面还是默认蓝）。
  // 所以颜色要写**两处**：先 `_color`（渲染真读的字段），再 `strokeColor`（回读一致 + 顺带 _markDirty）。
  // 填充材质读的是 `_style.fillColor || this.color`——有显式填充时不受影响，正好是要的「只动描边」。
  set_stroke: (args, kwargs) => {
    const calls: MethodCall[] = []
    const color = kwargs.color ?? args[0]
    const width = kwargs.width ?? args[1]
    const opacity = kwargs.opacity ?? args[2]
    if (color !== undefined) {
      calls.push({ js: '_color', args: [color], prop: true })
      calls.push({ js: 'strokeColor', args: [color], prop: true })
    }
    if (width !== undefined) calls.push({ js: 'setStrokeWidth', args: [width] })
    if (opacity !== undefined) calls.push({ js: 'setStrokeOpacity', args: [opacity] })
    // set_stroke() 无参是合法 no-op；桥的不变量是「变体非空」，给 setStyle({})——
    // 实现是 {...this._style} 合并空集、逐键检查全跳过，真无操作。
    if (calls.length === 0) return [[{ js: 'setStyle', args: [{}] }]]
    return [calls]
  },
  // CE `set_opacity(opacity, family=True)`：manim-web 把不透明度拆成 stroke / fill 两个。
  set_opacity: (args, kwargs) => {
    const opacity = kwargs.opacity ?? args[0]
    return [
      [
        { js: 'setStrokeOpacity', args: [opacity] },
        { js: 'setFillOpacity', args: [opacity] },
      ],
    ]
  },
  // CE `Mobject.restore()` 回到 save_state 的那一版；manim-web 的名字是 restoreState
  // （camel 推不出这个名，直传 restore 会落到不存在的属性上）。
  restore: () => [[{ js: 'restoreState', args: [] }]],
  // CE `arrange_in_grid(rows, cols, buff, ...)` 只有一个 buff，manim-web 是两个（buffX / buffY）——
  // 掰开的动作没法用「同名关键字搬位」表表达，单列一条。
  arrange_in_grid: (args, kwargs) => {
    const rows = kwargs.rows ?? args[0]
    const cols = kwargs.cols ?? args[1]
    const buff = kwargs.buff
    const buffX = kwargs.buff_x ?? buff ?? args[2]
    const buffY = kwargs.buff_y ?? buff ?? args[3]
    const call: unknown[] = [rows, cols]
    if (buffX !== undefined) call.push(buffX)
    if (buffY !== undefined) call.push(buffY)
    return [[{ js: 'arrangeInGrid', args: call }]]
  },
  // CE `get_area(graph, x_range=None, color=…, opacity=…, bounded_graph=None)`：manim-web 的
  // xRange 是**第二个位置参数**（不是选项），颜色那几项才走末尾的选项对象。
  get_area: (args, kwargs) => {
    const graph = args[0]
    const xRange = kwargs.x_range ?? args[1]
    const options: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(kwargs)) {
      if (key === 'x_range' || key === 'bounded_graph') continue
      options[camel(key)] = value
    }
    const call: unknown[] = [graph, xRange]
    if (Object.keys(options).length > 0) call.push(options)
    return [[{ js: 'getArea', args: call }]]
  },
  // CE `Line.put_start_and_end_on(start, end)`：manim-web 只在 Arrow/Vector 上同名，
  // Line 上要用 setStart + setEnd 两步。
  put_start_and_end_on: (args) => [
    [{ js: 'putStartAndEndOn', args: [args[0], args[1]] }],
    [
      { js: 'setStart', args: [args[0]] },
      { js: 'setEnd', args: [args[1]] },
    ],
  ],
  // CE `Axes.plot_line_graph(x_values, y_values, …)` 收两串位置参数；manim-web 收**一个选项对象**
  // `{ xValues, yValues, … }`（见 dist/mobjects/graphing/Axes.d.ts）。名字对得上但形状对不上——
  // 探针只测「方法在不在」，所以表里记 ok，CE 写法却会落到不存在的参数上、静默画错。
  // 返回的是 VDict（line_graph / vertex_dots），不是 CE 的 VGroup；当物体用没问题。
  plot_line_graph: (args, kwargs) => {
    const options = camelKeys({ ...kwargs })
    if (args[0] !== undefined) options.xValues = args[0]
    if (args[1] !== undefined) options.yValues = args[1]
    return [[{ js: 'plotLineGraph', args: [options] }]]
  },
}

/**
 * 「CE 写成关键字、manim-web 收位置」的方法：声明 manim-web 的位置参数顺序（写 CE 的关键字名）。
 *
 * 为什么必须搬：这些方法 manim-web 只收位置参数，把 `buff=0.5` 原样当实参传过去，
 * 它会落到**下一个位置参数**上（或干脆被忽略）——不报错、结果不对，是最难查的一类错。
 * 反过来 CE 写成位置的（`next_to(other, RIGHT)`）本来就对，不必登记。
 */
const POSITIONAL_ARGS: Record<string, string[]> = {
  next_to: ['mobject', 'direction', 'buff'],
  align_to: ['mobject', 'direction'],
  to_edge: ['direction', 'buff'],
  to_corner: ['direction', 'buff'],
  move_to: ['point', 'aligned_edge'],
  arrange: ['direction', 'buff', 'center'],
  set_fill: ['color', 'opacity'],
  rotate: ['angle', 'axis', 'about_point'],
  scale: ['scale_factor', 'about_point'],
  become: ['mobject'],
  add_updater: ['update_function'],
}

/** 方法调用的判定结果：`variants` 是候选调用组，由桥挑第一组能落地的。 */
export interface MethodPlan {
  variants: MethodCall[][]
}

/** 方法调用：改写表优先（能翻译的写法），否则按表校验 + 给 manim-web 的真方法名与实参。 */
export function planMethod(
  name: string,
  args: unknown[],
  kwargs: Record<string, unknown>,
): MethodPlan {
  const rewrite = METHOD_REWRITES[name]
  if (rewrite !== undefined) return { variants: rewrite(args, kwargs) }
  assertSupported(name)
  const mapped = PY_API_MAP[name]?.js
  const jsName = mapped !== undefined && IDENTIFIER.test(mapped) ? mapped : camel(name)
  const positional = [...args]
  const rest = { ...kwargs }
  const order = POSITIONAL_ARGS[name]
  if (order !== undefined) {
    // 只从**下一个**位置开始连续搬（前几个位置参数已经占了位的不能再搬）。
    for (let index = positional.length; index < order.length; index += 1) {
      const value = rest[order[index]]
      if (value === undefined) break
      positional.push(value)
      delete rest[order[index]]
    }
  }
  const kw = camelKeys(rest)
  return { variants: [[{ js: jsName, args: Object.keys(kw).length > 0 ? [...positional, kw] : positional }]] }
}

/**
 * animate 链：先把 CE 名换成 manim-web 代理上的真名（改写表），再校验白名单；
 * 白名单外的当场报错并列出可用的那组，不让它静默失效。
 */
export function planAnimate(
  calls: Array<{ name: string; args: unknown[]; kwargs: Record<string, unknown> }>,
): typeof calls {
  return calls.map((call) => {
    const rewritten = ANIMATE_REWRITES[call.name]
    const named = rewritten === undefined ? call : { ...call, name: rewritten }
    // 「代理有、物体没有」的坑：整次调用换个写法（见 ANIMATE_CALL_REWRITES）
    const redirect = ANIMATE_CALL_REWRITES[named.name]
    if (redirect !== undefined) return redirect(named.args, named.kwargs)
    if (!ANIMATE_ALLOWED.has(named.name)) {
      throw new Error(
        `animate 链不支持 ${call.name}()——只支持：${PY_ANIMATE_METHODS.join(' / ')}；` +
          '没有的方法得换写法（改属性可直接调同名方法，或用 play(Transform(...)) 补动画）',
      )
    }
    return named
  })
}
