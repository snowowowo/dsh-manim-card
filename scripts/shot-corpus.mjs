// 语料截图自查：把语料逐条丢进**真浏览器**（无头 Chromium）渲染，每条落一张 PNG。
//
// 为什么要有它：语料套件（examples.test.ts）只回答「跑通了没有」——语法过、没抛异常就算过。
// 但「跑通 ≠ 画对」：颜色被冲掉、形状跑到画外、轨迹是空的，这些一律跑到最后一行、退出码 0。
// 要抓这一类，只能**真渲染出画面来看**。本脚本就是那台相机：跑完把 PNG 落盘，逐条读图核对。
//
// 与卡片同源（这是关键，不是「差不多」）：
//   - Python 运行时 = 构建产物 core.js（Host 干跑用的同一份），不另抄一个解释器；
//   - manim-web 用 dist/manim-web.browser.js，即 package.json 的 ./browser 导出，与卡片同一个构建；
//   - 画布 = new manim.Scene(容器, {width:1280,height:720,autoResize:false,backgroundOpacity:0})
//     与 src/client/engine/canvas.ts 逐字一致（含 frameHeight=8 的坐标系归一）。
//   唯一有意的差别：页面底色给 #1C1C1C（manim 默认底色），让白描边的默认形状看得见——
//   卡片是透明底、靠宿主主题透出来，截图里没有「宿主主题」这东西，不给底色就等于白底白线。
//
// 运行：node scripts/shot-corpus.mjs [组名…] [选项]
//   位置参数    组名（默认 = 全部离线组：basic ctor method graph text updater animate scene lesson syntax api）
//   --only 子串   只跑 id 命中的（可多次）
//   --limit N     每组最多前 N 条（冒烟用）
//   --clean       先清空该组目录再截（默认是覆盖同名文件，不动别的）
//   --bg 颜色     页面底色（默认 #1C1C1C）
//   --realtime    不启用极速，按 run_time 真等（慢，用来核「动画过程」）
//   --out 目录    产物目录（默认 <插件仓根>/_dev/shots，即语料截图的正规位置）
//
// 产物：<out>/<组>/<同名>.png、<out>/index.json
//
// 产物默认落在**语料旁边**（`_dev/shots/`，包外）而不是 _tmp：这张图是「这条语料真渲染出来长什么样」
// 的唯一记录，回归只证明没炸、画面对不对只能看图。留在盘上+按同名归档，宿主就能把它发给实验场页面
// （见 src/host/corpus.js 的 shotPath() / shotsRoot()），页面直接显示——不必每次重截。
// 每次重跑**覆盖**同名文件（用户要的就是「永远是当前这版」）；`--clean` 才整目录清空。
// 顺带扫一遍孤儿图（语料里已经没有对应条目了）报出来——默认删掉会撞上宿主的批量删除保护，
// 而这类文件本来就极少，看见名字手删一次更省事。
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { collectCorpus, shotPath, shotsRoot } from '../src/host/corpus.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIM_DIST = join(root, 'node_modules', 'manim-web', 'dist')
const PYODIDE_DIR = join(root, 'assets', 'pyodide')
const KATEX_DIR = join(root, 'assets', 'katex')

/** 画布尺寸：与 src/client/engine/canvas.ts 的 WIDTH / HEIGHT 一致。 */
const WIDTH = 1280
const HEIGHT = 720

/** 无画面可截的两组：reject 是「应当被拒绝」，net 要联网取几十 MB 的包。 */
const NON_VISUAL = new Set(['reject', 'net'])

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  // wasm 必须是 application/wasm，浏览器才走流式编译
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
  '.whl': 'application/octet-stream',
}

function parseArgs(argv) {
  const groups = []
  const only = []
  const options = {
    limit: 0, bg: '#1C1C1C', realtime: false, clean: false, out: shotsRoot(),
    probe: null,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = () => argv[(index += 1)]
    if (arg === '--only') only.push(next())
    else if (arg === '--limit') options.limit = Number(next())
    else if (arg === '--bg') options.bg = next()
    else if (arg === '--out') options.out = resolve(next())
    else if (arg === '--realtime') options.realtime = true
    else if (arg === '--clean') options.clean = true
    else if (arg === '--probe') options.probe = resolve(next())
    else if (arg.startsWith('--')) throw new Error(`未知选项 ${arg}`)
    else groups.push(arg)
  }
  return { groups, only, options }
}

/**
 * 页面里跑的那段自举代码（以字符串塞进 harness，不经过打包器）。
 * 刻意与 src/client/engine/{canvas,pyodide,renderer}.ts 保持同一套调用形状——
 * 那三个文件是 TS + React 环境，这边要的是「同一个构建 + 同一套调用」，不是同一份源码。
 */
const HARNESS_SCRIPT = `
import * as manim from '/manim/manim-web.browser.js'
import { runPython, setPyodideLoader, createManimWebBridge } from '/core.js'

const WIDTH = ${WIDTH}
const HEIGHT = ${HEIGHT}
const container = document.getElementById('stage')
let scene = null

const loadScript = (src) => new Promise((ok, fail) => {
  const tag = document.createElement('script')
  tag.src = src
  tag.onload = () => ok()
  tag.onerror = () => fail(new Error('脚本加载失败：' + src))
  document.head.append(tag)
})

// 与 src/client/engine/pyodide.ts 同一套：<script> 引 pyodide.js，再 loadPyodide({indexURL})
setPyodideLoader(async () => {
  await loadScript('/pyodide/pyodide.js')
  const load = globalThis.loadPyodide
  if (typeof load !== 'function') throw new Error('pyodide.js 加载了但没暴露 loadPyodide')
  return load({ indexURL: '/pyodide/' })
})

// 与 src/client/engine/canvas.ts 的 createScene 逐字一致（含坐标系归一）
const newScene = () => {
  if (scene !== null) { try { scene.dispose() } catch {} scene = null; container.innerHTML = '' }
  scene = new manim.Scene(container, {
    width: WIDTH, height: HEIGHT,
    autoResize: false, backgroundOpacity: 0,
  })
  scene.camera.frameHeight = 8
  scene.camera.frameWidth = 8 * (WIDTH / HEIGHT)
  return scene
}

/**
 * 画布上「非透明像素」的占比：canvas 背景全透明（backgroundOpacity:0），
 * 所以有值的像素就是真画出来的东西——占比≈0 即「整张空白」。
 * ⚠️ 必须在**同一个 rAF 回调里**紧跟着 render() 读：WebGL 的绘制缓冲合成后会被清掉，
 * 出了这一帧再 drawImage 拿到的就是空图（preserveDrawingBuffer 未开）。
 */
const inkOf = (target) => {
  let canvas
  try { canvas = target.getCanvas() } catch { return 0 }
  if (!canvas) return 0
  // WebGL 画布上拿不到 2d 上下文，得先 drawImage 拷到一块 2d 画布上再读
  const probe = document.createElement('canvas')
  probe.width = 640; probe.height = 360
  const ctx = probe.getContext('2d')
  if (ctx === null) return 0
  ctx.drawImage(canvas, 0, 0, probe.width, probe.height)
  const data = ctx.getImageData(0, 0, probe.width, probe.height).data
  let inked = 0
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 8) inked += 1
  return inked / (probe.width * probe.height)
}

/** 跑一条：返回 ok / error / print 输出 / 墨迹占比。 */
window.__run = async ({ code, fast }) => {
  const logs = []
  const target = newScene()
  const bridge = createManimWebBridge({ manim, scene: target, fast })
  let error = null
  try {
    await runPython(code, bridge, { output: (text) => logs.push(text) })
  } catch (thrown) {
    error = thrown && thrown.message ? thrown.message : String(thrown)
  }
  // 极速模式下 duration=0 的动画可能在第一 tick 就收尾，落帧不保证发生过；补一帧兜底，
  // 顺手在同一帧里量墨迹。
  const ink = await new Promise((done) => requestAnimationFrame(() => {
    try { target.render() } catch {}
    done(inkOf(target))
  }))
  return { ok: error === null, error, logs, ink }
}

/** 调试：跑完把场景里每个物体的类名与关键几何读出来（--probe 用）。 */
window.__inspect = async ({ code, fast }) => {
  const logs = []
  const target = newScene()
  const bridge = createManimWebBridge({ manim, scene: target, fast })
  let error = null
  try {
    await runPython(code, bridge, { output: (text) => logs.push(text) })
  } catch (thrown) {
    error = thrown && thrown.message ? thrown.message : String(thrown)
  }
  const describe = (mobject, depth = 0) => {
    const row = { cls: mobject.constructor?.name ?? 'unknown' }
    for (const [key, read] of [
      ['center', (m) => JSON.stringify(Array.from(m.getCenter?.() ?? []))],
      ['width', (m) => Number(m.getWidth?.() ?? 0).toFixed(3)],
      ['color', (m) => String(m.getFill?.() ?? m.getColor?.() ?? m.strokeColor ?? '')],
      ['fillOpacity', (m) => Number(m.getFillOpacity?.() ?? -1).toFixed(2)],
      ['opacity', (m) => Number(m.opacity ?? -1).toFixed(2)],
      ['points', (m) => (m.getPoints ? 'n=' + m.getPoints().length : '')],
    ]) {
      try { const value = read(mobject); if (value !== undefined && value !== '') row[key] = value } catch {}
    }
    // 子物体递归一层：MathTex / VGroup 的「内容在子物体上」，只看顶层会误判成空的。
    if (depth < 1 && Array.isArray(mobject.children) && mobject.children.length > 0) {
      row.children = mobject.children.map((child) => describe(child, depth + 1))
    }
    return row
  }
  const objects = []
  try { for (const mobject of target.mobjects) objects.push(describe(mobject)) } catch {}
  return { ok: error === null, error, logs, objects }
}

window.__ready = true
`

/** 极小的静态服务：harness + core.js + manim-web dist + pyodide + katex。 */
async function serve(page, background) {
  const index = `<!doctype html><meta charset="utf-8"><title>manim 语料截图</title>
<link rel="stylesheet" href="/katex/katex.min.css">
<style>
  html, body { margin: 0; padding: 0; background: ${background}; }
  #stage { position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  #stage canvas { display: block; width: 100% !important; height: 100% !important; }
</style>
<div id="stage"></div>
<script type="module">${HARNESS_SCRIPT}</script>`

  const table = [
    [MANIM_DIST, '/manim/'],
    [KATEX_DIR, '/katex/'],
  ]
  // pyodide 两级：随包目录优先，缺的（第三方 wheel）落到用户缓存目录——
  // 与 src/host/index.js 的 pyodideRoute 同一套先后，只是没有「回源下载」这一级（截图自查不联网）。
  const CACHE_DIR = join(process.env.HOME ?? '~', '.dsh', 'cache', 'manim-renderer', 'pyodide')
  const pyodideDirs = [PYODIDE_DIR, ...(existsSync(CACHE_DIR) ? [CACHE_DIR] : [])]

  await page.route('**/*', async (route) => {
    const { pathname, href } = new URL(route.request().url())
    // manim-web 的 katexStyles 会从 jsdelivr 拉 KaTeX CSS（MathTexImage 光栅化靠它算布局）。
    // 截图环境离线，且本服务的兜底是 404——把这个 CDN 地址映射到随包的本地 katex，
    // 与真实产品一致（client/index.tsx 注入的正是这份本地 CSS），否则 Matrix 条目光栅化全空。
    if (href === 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css') {
      const file = join(KATEX_DIR, 'katex.min.css')
      if (existsSync(file)) {
        return route.fulfill({ status: 200, contentType: MIME['.css'], body: readFileSync(file) })
      }
    }
    if (pathname === '/' || pathname === '/index.html') {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: index })
    }
    if (pathname === '/core.js') {
      return route.fulfill({
        status: 200,
        contentType: MIME['.js'],
        body: readFileSync(join(root, 'core.js')),
      })
    }
    if (pathname.startsWith('/pyodide/')) {
      const name = decodeURIComponent(pathname.slice('/pyodide/'.length))
      if (name.includes('/')) return route.fulfill({ status: 404, body: '' })
      const found = pyodideDirs.map((dir) => join(dir, name)).find((file) => existsSync(file))
      if (found === undefined) return route.fulfill({ status: 404, body: '' })
      const ext = found.slice(found.lastIndexOf('.'))
      return route.fulfill({
        status: 200,
        contentType: MIME[ext] ?? 'application/octet-stream',
        body: readFileSync(found),
      })
    }
    for (const [base, prefix] of table) {
      if (!pathname.startsWith(prefix)) continue
      const file = resolve(base, decodeURIComponent(pathname.slice(prefix.length)))
      if (!file.startsWith(base) || !existsSync(file)) return route.fulfill({ status: 404, body: '' })
      const ext = file.slice(file.lastIndexOf('.'))
      return route.fulfill({
        status: 200,
        contentType: MIME[ext] ?? 'application/octet-stream',
        body: readFileSync(file),
      })
    }
    if (process.env.SHOT_DEBUG_404) console.error('[404]', href)
    return route.fulfill({ status: 404, body: '' })
  })

  await page.goto('http://manim-shots.local/')
  await page.waitForFunction('window.__ready === true', undefined, { timeout: 60_000 })
}

const { groups, only, options } = parseArgs(process.argv.slice(2))
const corpus = collectCorpus()

const wanted = groups.length > 0 ? new Set(groups) : null
const byGroup = new Map()
const selected = []
for (const example of corpus.examples) {
  if (NON_VISUAL.has(example.group)) continue
  if (example.expect === 'reject') continue // 无画面：应当被拒绝的条目（含混在 combo 里的 90-*.py）
  if (wanted !== null && !wanted.has(example.group)) continue
  if (only.length > 0 && !only.some((needle) => example.id.includes(needle))) continue
  const seen = byGroup.get(example.group) ?? 0
  if (options.limit > 0 && seen >= options.limit) continue
  byGroup.set(example.group, seen + 1)
  selected.push(example)
}

if (selected.length === 0 && options.probe === null) {
  console.error('没有选中任何语料——检查组名是否在 GROUPS 里')
  process.exit(1)
}

/** --probe：跑一个 Python 文件，打印 print 输出与场景物体清单（调试「画得对不对」用）。
 *  给了 --out 就把画面同时截成 PNG（调形状问题时对着图看）。 */
if (options.probe !== null) {
  const code = readFileSync(options.probe, 'utf8')
  const browser = await chromium.launch({ channel: 'chromium' })
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
    page.on('pageerror', (error) => console.error('[pageerror]', String(error).slice(0, 400)))
    // 调试期把页面 console 也带出来（调形状问题时经常要看 manim-web 自己打了什么）
    page.on('console', (message) => {
      const text = message.text()
      if (text.length > 0) console.error(`[console.${message.type()}]`, text.slice(0, 400))
    })
    await serve(page, options.bg)
    const outcome = await page.evaluate(
      ({ code, fast }) => window.__inspect({ code, fast }),
      { code, fast: !options.realtime },
    )
    if (options.out !== undefined) {
      const file = options.out.endsWith('.png') ? options.out : join(options.out, 'probe.png')
      mkdirSync(dirname(file), { recursive: true })
      await page.locator('#stage').screenshot({ path: file })
      console.error(`截图 → ${file}`)
    }
    await page.close()
    console.log(JSON.stringify(outcome, null, 2))
  } finally {
    await browser.close()
  }
  process.exit(0)
}

mkdirSync(options.out, { recursive: true })

console.info(
  `截图自查：${selected.length} 条（${[...new Set(selected.map((e) => e.group))].join(' / ')}）` +
    `｜${options.realtime ? '真等时间' : '极速落终态'}`,
)

const browser = await chromium.launch({ channel: 'chromium' })
const results = []
/** 碰过的分组：孤儿图要按组扫（声明在 try 外面——收尾统计在块外读它）。 */
const touchedGroups = new Set()

try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })
  const consoleErrors = []
  page.on('pageerror', (error) => consoleErrors.push(`[pageerror] ${String(error).slice(0, 300)}`))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`[console] ${message.text().slice(0, 300)}`)
  })
  await serve(page, options.bg)

  const stage = page.locator('#stage')
  const clearedGroups = new Set()
  let index = 0
  for (const example of selected) {
    index += 1
    // 产物路径 = 语料旁的**同名** PNG（唯一真源在 corpus.js 的 shotPath，与 Host 的路由同一份定义）
    const rel = shotPath(example.group, basename(example.file))
    const file = join(options.out, rel)
    // 默认只覆盖同名文件；--clean 才整目录清空（免得上一轮旧图混进来冒充本轮结果）
    if (options.clean && !clearedGroups.has(example.group)) {
      rmSync(dirname(file), { recursive: true, force: true })
      clearedGroups.add(example.group)
    }
    mkdirSync(dirname(file), { recursive: true })
    touchedGroups.add(example.group)

    const before = consoleErrors.length
    let outcome
    try {
      outcome = await page.evaluate(
        ({ code, fast }) => window.__run({ code, fast }),
        { code: example.python, fast: !options.realtime },
      )
    } catch (error) {
      outcome = { ok: false, error: `页面执行失败：${error instanceof Error ? error.message : String(error)}`, logs: [], ink: 0 }
    }

    await stage.screenshot({ path: file })

    results.push({
      id: example.id,
      group: example.group,
      title: example.title,
      shot: rel,
      expectation: example.expectation ?? null,
      browser: example.browser === true,
      ok: outcome.ok,
      error: outcome.error ?? null,
      ink: Number((outcome.ink ?? 0).toFixed(4)),
      logs: outcome.logs,
      console: consoleErrors.slice(before),
    })

    const mark = outcome.ok ? (outcome.ink < 0.005 ? '空' : '  ') : '错'
    console.info(
      `  [${String(index).padStart(3)}/${selected.length}] ${mark} ${example.id}` +
        (outcome.ok ? `  墨迹 ${(outcome.ink * 100).toFixed(1)}%` : `  ${String(outcome.error).slice(0, 140)}`),
    )
  }
  await page.close()
} finally {
  await browser.close()
}

writeFileSync(
  join(options.out, 'index.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), fast: !options.realtime, background: options.bg, results }, null, 2)}\n`,
)

const failed = results.filter((result) => !result.ok)
const blank = results.filter((result) => result.ok && result.ink < 0.002)

// 孤儿图：这一组里还留着、但语料已经没有对应条目的 PNG（改过文件名就会留下）。
// 参照系必须是**该组的完整语料**，不是本轮选中的那几条——否则一加 --only，同组其它图全成「孤儿」。
// 只报不删——这类文件极少，看见名字手删一次就好；在脚本里批量删会撞上宿主的删除保护，得不偿失。
const allShotsByGroup = new Map()
for (const example of corpus.examples) {
  if (NON_VISUAL.has(example.group)) continue
  const group = example.group
  const set = allShotsByGroup.get(group) ?? new Set()
  set.add(basename(shotPath(group, basename(example.file))))
  allShotsByGroup.set(group, set)
}

const orphans = []
for (const group of touchedGroups) {
  const dir = join(options.out, group)
  if (!existsSync(dir)) continue
  const expected = allShotsByGroup.get(group) ?? new Set()
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.png') && !expected.has(name)) orphans.push(`${group}/${name}`)
  }
}

console.info(
  `\n截图完成：${results.length} 条 → ${options.out}\n` +
    `  跑通 ${results.length - failed.length} / 报错 ${failed.length} / 疑似空白 ${blank.length}` +
    (failed.length > 0 ? `\n  报错：${failed.map((item) => item.id).join('、')}` : '') +
    (blank.length > 0 ? `\n  疑似空白：${blank.map((item) => item.id).join('、')}` : '') +
    (orphans.length > 0 ? `\n  孤儿图（语料里已无对应条目，可手删）：${orphans.join('、')}` : ''),
)
