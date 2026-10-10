// API 运行时实测探针：在**无头浏览器**里载入 manim-web（与卡片实际跑的那份同一入口），
// 按域清单 scripts/ce-public-api.json 逐项实测，产出 src/core/py/api-map.generated.ts
// （三态表：ok=直用 / alias=改名映射 / missing=缺失+替代文案）。
//
// 运行：node scripts/probe-api.mjs（在本包目录下）
//
// 两个事实来源：
//   - 「要测哪些名字」= scripts/ce-public-api.json（由 scripts/export-ce-api.py 从 Manim CE 枚举，
//     人工维护的只有方法清单那一组）。
//   - 「支不支持」= manim-web 本身，运行时实测为准。
//
// 为什么在浏览器里测而不是 Node 直跑：
//   ① 卡片本就在浏览器里跑，探针该测**同一个构建**，而不是在 Node 里测另一个；
//   ② 拿到真 canvas / AudioContext / MathJax 后，与渲染相关的类才构造得出来，方法索引才铺得开。
//
// 实测三层：① 存在性（导出名逐个查）② 构造（逐个无参 new，成功的建实例）③ 方法索引
// （遍历实例原型链取方法；**必须走 Object.getOwnPropertyDescriptor 并跳过存取器**——
// 直读属性会触发 getter 副作用，Node 基线那次就是被它崩在 AudioContext 上）。
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const domain = JSON.parse(readFileSync(join(root, 'scripts/ce-public-api.json'), 'utf8'))
const manimPkg = JSON.parse(readFileSync(join(root, 'node_modules/manim-web/package.json'), 'utf8'))
const manimDist = join(root, 'node_modules/manim-web/dist')

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
const snake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

/** 在页面里跑的实测：返回可以被 JSON 序列化的原始观测，判定留在 Node 侧。 */
async function measure(page, wanted) {
  return page.evaluate(({ colorNames, constNames, animNames, rateCandidates }) => {
    const manim = window.__manim
    const names = Object.keys(manim)

    // ② 构造：逐个无参 new，成功的留下实例（造不出来就只记下来，不强行补配方）
    //
    // *Proxy（AnimateProxy）是 animate 链的代理，不是物体：它的方法面单独从
    // Circle().animate 的原型实读（见 ③ 之后）。留在这里会把**只存在于代理上**的方法
    // （setOpacity 就是）记成普通物体也支持——预检放行、真桥报错，正是 SSOT 要消灭的那类不一致。
    const PROXY_SUFFIX = 'Proxy'
    const instances = []
    const failed = []
    const proxies = []
    for (const name of names) {
      const Ctor = manim[name]
      if (typeof Ctor !== 'function') continue
      if (name.endsWith(PROXY_SUFFIX)) {
        proxies.push(name)
        continue
      }
      try {
        const instance = new Ctor()
        if (instance !== null && typeof instance === 'object') instances.push([name, instance])
        else failed.push(name)
      } catch {
        failed.push(name)
      }
    }

    // ③ 方法索引：走描述符、跳存取器（读属性会触发副作用）
    // methodIndex 必须无原型：方法名里就有 toString / valueOf / isPrototypeOf 这些，
    // 普通对象会让 (methodIndex[m] ??= []) 读到 Object.prototype 上的同名函数而炸。
    let accessorsSkipped = 0
    const methodIndex = Object.create(null)
    for (const [label, instance] of instances) {
      const found = new Set()
      let proto = instance
      while (proto !== null && proto !== Object.prototype) {
        for (const key of Object.getOwnPropertyNames(proto)) {
          if (key === 'constructor') continue
          const descriptor = Object.getOwnPropertyDescriptor(proto, key)
          if (descriptor === undefined) continue
          if (descriptor.get !== undefined || descriptor.set !== undefined) {
            accessorsSkipped += 1
            continue
          }
          if (typeof descriptor.value === 'function') found.add(key)
        }
        proto = Object.getPrototypeOf(proto)
      }
      for (const method of found) (methodIndex[method] ??= []).push(label)
    }

    // 场景方法：Scene 构造要真画布，这里只读原型（不建实例）
    const sceneProto = new Set()
    try {
      let proto = manim.Scene?.prototype ?? null
      while (proto !== null && proto !== Object.prototype) {
        for (const key of Object.getOwnPropertyNames(proto)) {
          if (key === 'constructor') continue
          const descriptor = Object.getOwnPropertyDescriptor(proto, key)
          if (descriptor === undefined) continue
          if (descriptor.get !== undefined || descriptor.set !== undefined) {
            accessorsSkipped += 1
            continue
          }
          if (typeof descriptor.value === 'function') sceneProto.add(key)
        }
        proto = Object.getPrototypeOf(proto)
      }
    } catch {
      /* 没有 Scene 就留空 */
    }

    // animate 链能链哪些方法：从 animate 代理原型实读。begin/interpolate/finish 是
    // Animation 的生命周期钩子，不是可写的动画动作，排除。
    const ANIMATE_EXCLUDE = new Set(['constructor', 'begin', 'interpolate', 'finish'])
    let animateMethods = []
    try {
      const probe = new manim.Circle({ radius: 1 })
      const proto = Object.getPrototypeOf(probe.animate)
      animateMethods = Object.getOwnPropertyNames(proto)
        .filter((key) => {
          const descriptor = Object.getOwnPropertyDescriptor(proto, key)
          return descriptor !== undefined && typeof descriptor.value === 'function' && !ANIMATE_EXCLUDE.has(key)
        })
        .map((key) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`))
    } catch {
      /* manim-web 没有 animate 就留空 */
    }

    // 动画的调用形状：manim-web 的**类构造器**参数形状与 CE 不一致（`Rotate` 第 2 个参数
    // 是 `{angle}` 选项对象，`Rotate(m, PI)` 直接 typia 报错），而**工厂函数**才是 CE 形状
    // （`rotate(mobject, angle, options?)`）。所以逐个量「有没有同名工厂」——名字是类名首字母小写。
    const factories = {}
    for (const name of animNames) {
      const lower = name.charAt(0).toLowerCase() + name.slice(1)
      factories[name] = typeof manim[lower] === 'function' && manim[lower] !== manim[name]
    }

    // 归类（物体 / 动画）：按**运行时原型链**实测，不看它挂在哪个模块下。
    // 为什么必须实测：CE 把自己的 TracedPath / AnimatedBoundary 放在 manim/animation/changing.py 里，
    // 两者其实 extends VMobject——按模块分组归成动画，适配层就会生成 _Animation 工厂，
    // 于是 self.add(traced, dot) 拿不到句柄（报「未知的对象句柄 <manim._Animation object>」）。
    // 实测能纠的不止这两个：将来 manim-web 再往 animation/ 下放物体类，这里自动跟正。
    const lineage = {}
    const MOB = manim.Mobject?.prototype ?? null
    const ANIM = manim.Animation?.prototype ?? null
    for (const name of names) {
      const value = manim[name]
      const proto = typeof value === 'function' ? value.prototype : undefined
      if (proto === undefined || proto === null) continue
      // 基类自己不算（Mobject / Animation 不参与归类）；动画先判——万一某个动画也继承物体，以动画为准
      if (ANIM !== null && ANIM !== proto && ANIM.isPrototypeOf(proto)) lineage[name] = 'anim'
      else if (MOB !== null && MOB !== proto && MOB.isPrototypeOf(proto)) lineage[name] = 'mobject'
    }

    // 颜色与常量的值：只有页面里才拿得到（Node 侧不 import manim-web）
    const colors = {}
    for (const name of colorNames) {
      const value = manim[name] ?? manim[String(name).replace(/^GREY/, 'GRAY')]
      colors[name] = typeof value === 'string' ? value.toUpperCase() : null
    }
    const constants = {}
    for (const name of constNames) {
      const value = manim[name]
      constants[name] = value === undefined ? null : JSON.stringify(value)
    }

    // 速率函数：**按行为判**，不看名字是否存在——`wiggle` 这个导出其实是动画工厂（不是速率函数），
    // 只查存在性会把它记成可用，`rate_func=wiggle` 于是过预检、真桥拿到一个对象。
    // direct  = 直接就是 (t) => number
    // curried = 柯里化工厂，要先无参调一次才拿到真函数（runningStart() 这种）
    const rateProbe = (value) => {
      if (typeof value !== 'function') return 'none'
      try {
        if (typeof value(0) === 'number' && typeof value(1) === 'number') return 'direct'
      } catch {
        /* 不是速率函数，继续试柯里化 */
      }
      try {
        const inner = value()
        if (typeof inner !== 'function') return 'none'
        const samples = [0, 0.25, 0.5, 0.75, 1].map((t) => inner(t))
        if (!samples.every((v) => typeof v === 'number')) return 'none'
        // 排除「恒为常数」的退化行（柯里化工厂传错参数时会这样）
        return samples.some((v) => v !== samples[0]) ? 'curried' : 'none'
      } catch {
        return 'none'
      }
    }
    const rates = {}
    for (const name of rateCandidates) rates[name] = rateProbe(manim[name])

    return {
      names,
      constructed: instances.map(([label]) => label),
      failed,
      proxies,
      methodIndex,
      sceneMethods: [...sceneProto],
      animateMethods,
      factories,
      lineage,
      colors,
      constants,
      rates,
      accessorsSkipped,
      manimWebExports: names.length,
    }
  }, wanted)
}

/**
 * 极小的静态服务：把 manim-web 的 dist 目录按 /manim/... 供出去。
 *
 * 入口用 `dist/manim-web.browser.js`（即 manim-web 的 `./browser` 导出，官方浏览器构建），
 * 而不是 `dist/index.js`：后者是给打包器用的 ESM，里面留着 `three` / `@mathjax/src` / `opentype.js`
 * 等**裸模块名**，浏览器原生 import 解析不了（要靠打包器解析）；前者是自包含的浏览器产物。
 * 两者同一版本、同一份类型声明（package.json 里 `./browser` 与 `.` 共用 dist/index.d.ts），
 * 导出面一致——对「哪些名字存在」的实测结论没有差别。
 */
async function serveManimWeb(page) {
  const HARNESS = `<!doctype html><meta charset="utf-8"><title>manim-web probe</title>
<script type="module">
import * as manim from '/manim/manim-web.browser.js'
window.__manim = manim
window.__probeReady = true
</script>`
  await page.route('**/*', async (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/' || pathname === '/index.html') {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HARNESS })
    }
    if (pathname.startsWith('/manim/')) {
      const file = resolve(manimDist, decodeURIComponent(pathname.slice('/manim/'.length)))
      if (!file.startsWith(manimDist)) return route.fulfill({ status: 403, body: '' })
      try {
        return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: readFileSync(file) })
      } catch {
        return route.fulfill({ status: 404, body: '' })
      }
    }
    return route.fulfill({ status: 404, body: '' })
  })
  await page.goto('http://manim-probe.local/')
  await page.waitForFunction('window.__probeReady === true', undefined, { timeout: 60_000 })
}

/**
 * 替代文案表：只在**实测缺失**或 alias 未命中时被读到（实测存在就走 ok，这里写了也不生效），
 * 因此允许留一些现已支持的名字当回归兜底。
 *
 * 铁律：文案里引用的方法名**必须真实存在**。曾出现 bring_to_front 让人去调并不存在的
 * set_z_index、get_part_by_tex 让人去调并不存在的 getPartCount——指错路比不指路更糟。
 */
const KNOWN_MISSING = {
  restore: '用 save_state() 存快照、restoreState() 恢复；都不可用就用 Transform 回原状或重建对象',
  become: '用 ReplacementTransform（目标留下）',
  to_edge: '用 move_to() 对齐画布边缘坐标',
  to_corner: '用 move_to() 对齐画布角坐标',
  surround: '用 get_bounding_box() 取外接框后自建 Rectangle',
  always: '用 add_updater() 组合重画',
  always_redraw: '用 add_updater() 组合重画',
  always_rotate: '用 add_updater() 挂 rotate',
  always_shift: '用 add_updater() 挂 shift',
  get_part_by_tex: 'MathTex 取段用 m[i]（manim-web 只有 getPart(序号)，没有按 tex 找）',
  stretch: '用 scale()（x/y 方向分别缩放）',
  flip: '用 rotate() 或 scale() 带负轴向',
  put_start_and_end: '用 put_start_and_end_on(a, b)，或 set_start(a) + set_end(b)',
  interpolate: '用 set_value() / get_value()',
  bring_to_front: '用 set_z(较大值) 提到上层（manim-web 没有 Scene 级层级重排）',
  bring_to_back: '用 set_z(较小值) 压到下层',
  set_z_index: '用 set_z(数值) 设层级',
  MovingCameraScene: '相机控制不支持——用默认 Scene 构图',
  ThreeDScene: '3D 相机运镜部分受限——基础 3D 物体可用',
  PolarPlane: '极坐标不支持——用 Axes 自画',
  plot_parametric_curve: '用 plot() 画按参数方程采样好的点',
  plot_derivative_graph: '用 plot() 画手算好的导数',
}

/** CE 标准色板兜底值（manim-web 常量不是 string 时用）。数值取自 ManimCE utils/color.py。 */
const CE_COLOR_FALLBACK = {
  BLUE_A: '#C7E9F1', BLUE_B: '#9CDCEB', BLUE_C: '#58C4DD', BLUE_D: '#29ABCA', BLUE_E: '#236B8E',
  TEAL_A: '#ACEAD7', TEAL_B: '#76DDC0', TEAL_C: '#5CD0B3', TEAL_D: '#55C1A7', TEAL_E: '#49A88F',
  GREEN_A: '#C9E2AE', GREEN_B: '#A6CF8C', GREEN_C: '#83C167', GREEN_D: '#77B05D', GREEN_E: '#699C52',
  YELLOW_A: '#FFF1B6', YELLOW_B: '#FFEA94', YELLOW_C: '#FFFF00', YELLOW_D: '#F4D345', YELLOW_E: '#E8C11C',
  GOLD_A: '#F7C797', GOLD_B: '#F9B775', GOLD_C: '#F0AC5F', GOLD_D: '#E1A158', GOLD_E: '#C78D46',
  RED_A: '#F7A1A3', RED_B: '#FF8080', RED_C: '#FC6255', RED_D: '#E65A4C', RED_E: '#CF5044',
  MAROON_A: '#ECABC1', MAROON_B: '#E1799C', MAROON_C: '#C55F73', MAROON_D: '#A24D61', MAROON_E: '#94424F',
  PURPLE_A: '#CAA3E8', PURPLE_B: '#B189C6', PURPLE_C: '#9A72AC', PURPLE_D: '#715582', PURPLE_E: '#644172',
  GREY_A: '#DDDDDD', GREY_B: '#BBBBBB', GREY_C: '#888888', GREY_D: '#444444', GREY_E: '#222222',
  BLUE: '#58C4DD', TEAL: '#5CD0B3', GREEN: '#83C167', YELLOW: '#FFFF00', GOLD: '#F0AC5F',
  RED: '#FC6255', MAROON: '#C55F73', PURPLE: '#9A72AC', PINK: '#D147BD',
  LIGHT_PINK: '#DC75CD', ORANGE: '#FF862F', LIGHT_ORANGE: '#FF9A1F', DARK_ORANGE: '#FF6F1E',
  GREY_BROWN: '#736357', LIGHT_BROWN: '#CD853F', DARK_BROWN: '#8B4513',
  GREY: '#888888', LIGHT_GRAY: '#BBBBBB', DARK_GRAY: '#444444', WHITE: '#FFFFFF', BLACK: '#000000',
  PURE_RED: '#FF0000', PURE_GREEN: '#00FF00', PURE_BLUE: '#0000FF',
}

/** 命中实例的记账口径：targets 只留前几个（表要紧凑），总命中数另记 hits。 */
const TARGETS_KEPT = 6

/**
 * 速率函数的改名表：CE 名 → manim-web 的导出名。
 * 同名同形的（linear / smooth / lingering / smoothstep / smootherstep / smoothererstep）不写，
 * 由域清单的名字直接查；这里只列**两边名字不一样**的。是否真的可用由页面里按行为实测决定。
 */
const KNOWN_RATE = {
  double_smooth: 'doubleSmooth',
  exponential_decay: 'exponentialDecay',
  not_quite_there: 'notQuiteThere',
  running_start: 'runningStart',
  rush_from: 'rushFrom',
  rush_into: 'rushInto',
  slow_into: 'slowInto',
  there_and_back: 'thereAndBack',
  there_and_back_with_pause: 'thereAndBackWithPause',
  wiggle: 'wiggleRate',
}

const entries = {}
const colors = {}

const put = (name, kind, state, js, alt, targets, extra) => {
  const kept = targets === undefined ? undefined : [...new Set(targets)].sort()
  entries[name] = {
    kind,
    state,
    ...(js ? { js } : {}),
    ...(alt ? { alt } : {}),
    ...(extra ?? {}),
    ...(kept?.length ? { targets: kept.slice(0, TARGETS_KEPT) } : {}),
    ...(kept !== undefined && kept.length > 0 ? { hits: kept.length } : {}),
  }
}

// 用完整 Chromium（channel: 'chromium'）而不是默认的 chrome-headless-shell：
// ① 完整浏览器带真 canvas / AudioContext / 字体 / MathJax，② 与 `playwright install chromium`
// 装下来的完整包一一对应，不额外依赖那个独立下载的 headless-shell。
const browser = await chromium.launch({ channel: 'chromium' })
let observed
try {
  const page = await browser.newPage()
  // harness 加载失败（缺资源 / 语法错）时给出台面上可见的原因，别只留一个超时
  page.on('pageerror', (error) => console.error('[probe:pageerror]', String(error).slice(0, 400)))
  await serveManimWeb(page)
  observed = await measure(page, {
    colorNames: domain.colors,
    constNames: [...domain.constants.direction, ...domain.constants.math],
    animNames: domain.animations,
    rateCandidates: [
      ...new Set([
        ...domain.rates,
        ...Object.values(KNOWN_RATE),
        // 域清单里的名字自己也要测：同名的那批直接按 CE 名查
      ]),
    ],
  })
  await page.close()
} finally {
  await browser.close()
}

const hasExport = (name) => observed.names.includes(name)
// 只认自有键：跨端回来后 methodIndex 又是普通对象了，toString 这类会从 Object.prototype 读出来
const ownHits = (jsName) =>
  Object.prototype.hasOwnProperty.call(observed.methodIndex, jsName) ? observed.methodIndex[jsName] : []
const hasMethod = (jsName) => ownHits(jsName).length > 0
const hasSceneMethod = (jsName) => observed.sceneMethods.includes(jsName)
const hitsOf = (jsName) => ownHits(jsName)

/**
 * 同一动作改了名的方法：CE 写法 → manim-web 真方法名。
 * camelCase 推不出来（restore → restoreState），只能人工列；实测目标方法在才采用。
 * 采用后表里记成 **ok + 真名（identifier）**——planMethod 只认 identifier 才拿去用，否则会退回 camel 而调用失败。
 */
const KNOWN_RENAME = {
  restore: { js: 'restoreState', ok: () => hasMethod('restoreState') },
}

/**
 * 由**判定层改写**的方法（`src/core/py/surface.ts` 的 `METHOD_REWRITES`）：表里记 `alias` + 落点说明。
 *
 * 为什么手写在探针里而不是实测：探针只能回答「manim-web 有没有 `setStroke`」——`setStroke` 确实在
 * 6 个子类上有，于是 camel 那一支会把它记成 `ok`，可普通物体（Line / Dot）根本没有它，模型照表写
 * `line.set_stroke(...)` 就会「预检过、真桥炸」。「CE 的 `set_stroke` 对应 manim-web 的哪个方法」是
 * **语义判断**，实测不出来，只能与改写表一处声明。这里列一遍是为了：① 表不把它记成 ok（免得再误导）；
 * ② 技能文档与报错文案知道它「支持，但要改写」。
 *
 * 与「记 missing」那条老规矩的关系：老规矩（见 KNOWN_MISSING 里的 set_opacity/put_start_and_end 注释）
 * 是「要两三个方法拼出 CE 一个方法的，一律记 missing + 给改法」，因为当时 alias 只是**放行、不翻译**，
 * 放行到真桥才炸。现在改写真的落了地（判定给得出可执行调用），这几个就转正成 alias——
 * **放行是真的**才是 alias 的本义（同 `animate` 链、`m[i]`）。
 */
const REWRITTEN_METHODS = {
  set_stroke: 'setStyle({ strokeColor, strokeWidth, strokeOpacity })',
  set_opacity: 'setStrokeOpacity(x) + setFillOpacity(x)',
  put_start_and_end_on: 'putStartAndEndOn(s, e)（Arrow/Vector）/ setStart(s) + setEnd(e)（Line）',
}

/**
 * 这个 CE 名在 manim-web 里是**物体**还是**动画**：按运行时原型链实测（见 measure 的 lineage）。
 *
 * 为什么不信 CE 域清单的分组：CE 把自己的 TracedPath / AnimatedBoundary 放在
 * `manim/animation/changing.py` 里，两者其实 extends VMobject。按分组归成动画 ⇒ 适配层生成
 * `_Animation` 工厂 ⇒ `self.add(traced, dot)` 过桥报「未知的对象句柄 <manim._Animation object>」。
 * **域清单只回答「要测哪些名字」，不回答「它是什么」**——后者一律实测。
 * 实测不出来（导出不是可 new 的类）才退回分组。api-map.test.ts 有一条门禁把这条锁住。
 */
const kindOf = (name, fallback) => observed.lineage[name] ?? fallback

/** 动画项：调工厂还是类构造——manim-web 的类构造器形状与 CE 不一致，存在同名工厂就用工厂。 */
const putAnimation = (name) => {
  const lower = name.charAt(0).toLowerCase() + name.slice(1)
  if (observed.factories[name]) put(name, 'anim', 'ok', lower, undefined, undefined, { call: 'factory' })
  else put(name, 'anim', 'ok', name, undefined, undefined, { call: 'new' })
}

const missingAlt = (name) => KNOWN_MISSING[name] ?? `manim-web 没有这个形状（${name}）——查支持速查表选等价写法`

// 类与动画：CE 名在 manim-web 里有没有同名导出；是物是动画由实测定（见 kindOf）
for (const name of domain.classes) {
  if (!hasExport(name)) {
    put(name, 'class', 'missing', undefined, missingAlt(name))
    continue
  }
  if (kindOf(name, 'class') === 'anim') putAnimation(name)
  else put(name, 'class', 'ok', `manim.${name}`)
}
for (const name of domain.animations) {
  if (!hasExport(name)) {
    put(name, 'anim', 'missing', undefined, missingAlt(name))
    continue
  }
  if (kindOf(name, 'anim') === 'mobject') put(name, 'class', 'ok', `manim.${name}`)
  else putAnimation(name)
}
for (const name of domain.functions) {
  if (hasExport(name)) put(name, 'function', 'ok', `manim.${name}(...)`)
  else put(name, 'function', 'missing', undefined, KNOWN_MISSING[name] ?? 'manim-web 没有这个函数——用 add_updater() 自己写')
}

// 常量（方向 / 数学）与颜色
//
// 适配层自带的常量：manim-web 没有，但插件里照写可用（值由 manim-shim.ts 的 SHIM_BASE 定义）。
// 只按 manim-web 判会把它们记成 missing，技能文档于是写「别写 PI」——而 CE 代码里 PI 满天飞。
// ⚠️ 改这个集合要同步改 manim-shim.ts（SHIM_BASE + RESERVED）。
const ADAPTER_CONSTANTS = new Set(['PI', 'TAU', 'DEGREES', 'X_AXIS', 'Y_AXIS', 'Z_AXIS'])

for (const name of [...domain.constants.direction, ...domain.constants.math]) {
  if (hasExport(name)) put(name, 'const', 'ok', `manim.${name}`)
  else if (ADAPTER_CONSTANTS.has(name)) put(name, 'const', 'ok', name)
  else put(name, 'const', 'missing', undefined, '画布不支持——用 [x, y, 0] 数组或直接写数值')
}
for (const name of domain.colors) {
  const hex = observed.colors[name] ?? CE_COLOR_FALLBACK[name] ?? null
  // 只把**真有值**的颜色写进 PY_COLOR_HEX。它是 Record<string, string>，混进 null 会被适配层
  // 当成 Python 常量生成 `NAME = null`，整个 shim 直接 NameError（CE 色板比 manim-web 大，踩过）。
  if (hex) colors[name] = hex
  put(name, 'color', hex ? 'ok' : 'missing', hex ?? undefined, hex ? undefined : '画布不支持——用 hex 字符串')
}

// 速率函数：按**行为**实测（见 measure 里的 rateProbe），不是查名字在不在。
// 名字两边不一样的走 KNOWN_RATE 改名；柯里化的记 curried（判定/桥要先无参调一次）。
for (const name of domain.rates) {
  const js = KNOWN_RATE[name] ?? name
  const kind = observed.rates[js]
  if (kind === 'direct') put(name, 'rate', 'ok', js)
  else if (kind === 'curried') put(name, 'rate', 'ok', js, undefined, undefined, { curried: true })
  else put(name, 'rate', 'missing', undefined, '画布不支持——用 smooth / linear / there_and_back')
}

// 方法：按域清单的名字逐个在实例索引里找（命中即列出命中的实例）
for (const [group, names] of Object.entries(domain.mobjectMethods)) {
  for (const name of names) {
    if (name === 'animate') {
      const available = observed.animateMethods.length > 0
      put(
        'animate',
        'method',
        available ? 'alias' : 'missing',
        available ? 'play(m.animate.x(...))' : undefined,
        available
          ? `animate 链可用，但只覆盖这组方法：${observed.animateMethods.join(' / ')}；没有的方法（如 set_value）得换写法`
          : 'animate 属性不存在——属性变化直接调方法或用 Transform',
        ['circle'],
      )
      continue
    }
    if (name === 'indexing') {
      // MathTex 取段：Python m[i] → getPart(i)
      if (hasMethod('getPart')) put('m[i]', 'method', 'alias', 'getPart(i)（MathTex 取段）')
      else put('m[i]', 'method', 'missing', undefined, KNOWN_MISSING.get_part_by_tex)
      continue
    }
    // 改写表接管的方法：记 alias + 落点，不按 camel 猜的名字记 ok（那个名字在普通物体上不存在）
    const rewritten = REWRITTEN_METHODS[name]
    if (rewritten !== undefined) {
      put(name, group === 'scene' ? 'scene-method' : 'method', 'alias', rewritten)
      continue
    }
    const jsName = camel(name)
    const isScene = group === 'scene'
    const targets = isScene ? (hasSceneMethod(jsName) ? ['scene'] : []) : hitsOf(jsName)
    const rename = KNOWN_RENAME[name]
    if (targets.length > 0) put(name, isScene ? 'scene-method' : 'method', 'ok', jsName, undefined, targets)
    else if (rename?.ok()) put(name, isScene ? 'scene-method' : 'method', 'ok', rename.js)
    else put(name, 'method', 'missing', undefined, KNOWN_MISSING[name] ?? `manim-web 没有这个方法（${name}()）——查支持速查表选等价写法`)
  }
}

const stats = Object.values(entries)
const count = (state) => stats.filter((entry) => entry.state === state).length
const source = domain._source

const ts = [
  '// 由 scripts/probe-api.mjs 生成（勿手改；升级 manim-web 或 CE 后重跑）。',
  `// 事实来源：Manim CE ${source.version}（域清单 scripts/ce-public-api.json）× manim-web ${manimPkg.version}`,
  '//            —— 无头浏览器内逐项实测：ok=直用；alias=改名/改写映射（判定层翻得出可执行调用）；',
  '//               missing=缺失（alt 为报错替代文案）。',
  '// 注意：域清单只定「测哪些名字」，不定「它是什么」——kind（物体/动画）按 manim-web 的运行时原型链实测。',
  '//        CE 把 TracedPath / AnimatedBoundary 放在 animation/ 模块里，两者其实 extends VMobject。',
  '',
  "export type PyApiState = 'ok' | 'alias' | 'missing'",
  '',
  'export interface PyApiEntry {',
  "  kind: 'class' | 'anim' | 'function' | 'const' | 'color' | 'rate' | 'method' | 'scene-method'",
  '  state: PyApiState',
  '  /** ok/alias 的目标写法（js 真名或映射说明） */',
  '  js?: string',
  '  /** alias/missing 的替代方案（进报错文案） */',
  '  alt?: string',
  '  /** anim：调工厂函数（CE 形状）还是类构造——manim-web 两者的参数形状不一样 */',
  "  call?: 'factory' | 'new'",
  '  /** rate：manim-web 里是柯里化工厂，要先无参调一次才拿到速率函数 */',
  '  curried?: boolean',
  '  /** method 实测命中的探测实例（只留前几个；总数见 hits） */',
  '  targets?: string[]',
  '  /** method 实测命中的实例总数 */',
  '  hits?: number',
  '}',
  '',
  `export const PY_API_MAP: Record<string, PyApiEntry> = ${JSON.stringify(entries, null, 2)}`,
  '',
  `export const PY_COLOR_HEX: Record<string, string> = ${JSON.stringify(colors, null, 2)}`,
  '',
  '/** m.animate.<方法>(...) 可链的方法（snake_case；适配层据此做 snake→camel 映射与拦错）。 */',
  `export const PY_ANIMATE_METHODS: string[] = ${JSON.stringify(observed.animateMethods, null, 2)}`,
  '',
]

const genPath = join(root, 'src/core/py/api-map.generated.ts')
writeFileSync(genPath, ts.join('\n'))
console.log(
  `三态表完成：${genPath}\n` +
    `  共 ${stats.length} 项：ok ${count('ok')} / alias ${count('alias')} / missing ${count('missing')}\n` +
    `  实测环境：无头 Chromium；manim-web 导出 ${observed.manimWebExports} 个，` +
    `无参构造成功 ${observed.constructed.length} 个（排除代理 ${observed.proxies.join(' / ') || '无'}），` +
    `方法索引去重 ${Object.keys(observed.methodIndex).length} 个，` +
    `跳过存取器 ${observed.accessorsSkipped} 个`,
)
