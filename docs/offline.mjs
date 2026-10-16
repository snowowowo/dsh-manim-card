#!/usr/bin/env node
// 离线副本：把 VitePress 的 dist 转成「双击就能看」的一份（不起服务器）。
//
// 为什么直开 dist 不行（四条独立原因，都会真实发生）：
//   ① 资源是**绝对 base**（`/仓名/assets/…`，为 GitHub Pages 而设）——`file://` 下它们指向
//      **文件系统根**，样式表/图片全 404，侧栏链接也全断；
//   ② 浏览器禁止从 `file://` 加载 **ES module**（CORS），VitePress 运行时（搜索 / 主题切换 /
//      SPA 切页）永远跑不起来；
//   ③ 侧栏折叠组靠 JS 开合、目录链接靠服务器补 `index.html`——脚本剥掉、服务器没有之后，
//      折叠的组点不开、以 `/` 结尾的链接会落到「目录索引」；
//   ④ 右栏「本页目录」也是**客户端**填的（见 OUTLINE 一段），脚本剥掉后整根不可见。
// 本脚本把 ① 改成**按页面所在深度相对**（站内链接因此点得动），把 ② 的 module 脚本剥掉
// （留着只会在控制台刷 CORS 报错），并针对 ③ 补 `index.html` + 注入摊开侧栏的 CSS、
// 针对 ④ 在构建期把目录算好写进 HTML。
// 页面内容是**预渲染**的——"读文档"这件事不受影响。
//
// 用法（在本 docs/ 目录里）：`pnpm offline`（内部先跑 vitepress build），或 `node offline.mjs`。
// 产物：`<仓根>/_tmp/docs-offline/`（各仓都忽略 `_tmp/`，不进 git；随时可重建、可删除）。
//
// ⚠️ 本文件是**标准件**：唯一源在 `dsh-plugin-template/docs/offline.mjs`，各文档站逐字节复制；
// 容器仓 `pnpm check:preset` 会逐字节核对，漂移即红。要改先改唯一源，再 cp 到各站。
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const docsDir = dirname(fileURLToPath(import.meta.url))
const dist = join(docsDir, '.vitepress', 'dist')
const out = resolve(docsDir, '..', '_tmp', 'docs-offline')

if (!existsSync(dist)) {
  console.error('[offline] 没有 .vitepress/dist——先构建：pnpm build')
  process.exit(1)
}

// base 从产物里读（形如 `/manim-live/`），不写死——同一份脚本要贴进所有文档站。
const baseMatch = readFileSync(join(dist, 'index.html'), 'utf8').match(/(?:href|src)="(\/[^"]+?\/)assets\//)
if (baseMatch === null) {
  console.error('[offline] 认不出 base（产物里没有 /<base>/assets/ 形态的资源地址）')
  process.exit(1)
}
const base = baseMatch[1]

/**
 * 离线副本对侧栏的两处修正（都因为脚本被剥掉、没有 JS 兜底）：
 *
 *  1. **折叠组一律摊开**——折叠是 VitePress 的 JS 行为，脚本剥掉后折叠组点一下就永远打不开，
 *     组里的页面等于从侧栏消失。原规则是 `.VPSidebarItem.collapsed .items[data-v-…]{display:none}`，
 *     特异性更高，靠 `!important` 取胜。
 *  2. **顶部让开导航栏**——主题给桌面侧栏的 `padding-top` 正好等于导航栏高度（64px），
 *     第一项紧贴导航栏下沿，看着像被压住；窄屏那条更短（32px，本来靠抽屉从上方盖过去）。
 *     统一改成「导航栏高度 + 16px」，两种布局都不会贴在一起。
 */
const UNFOLD_CSS =
  '.VPSidebarItem.collapsed>.items{display:block!important}' +
  '.VPSidebarItem.collapsed .caret-icon{transform:rotate(90deg)!important}' +
  '.VPSidebar{padding-top:calc(var(--vp-nav-height) + 16px)!important}'

/**
 * 离线副本对右栏「本页目录」的修正——它是**客户端**填的，不是预渲染的：
 *
 * `VPDocAsideOutline` 的 `headers` 在组件 setup 时是空数组，靠 `onContentUpdated`（挂载之后）
 * 从 DOM 里抓 h2/h3 才填上，SSR 只吐一个空 `<ul class="VPDocOutlineItem root">`；而
 * `.VPDocAsideOutline` 不带 `.has-outline` 时是 `display:none`。两者一叠加：**脚本被剥掉之后，
 * 右栏连标题都不剩**——页面上只留一条 256px 的空列，看着就是「右侧导航全没了」。
 *
 * 这里在构建期把同一件事做掉：按默认主题的口径（`outline.level = [2,3]`、跳过带
 * `ignore-header` 的标题、整棵子树一起跳过）自己算出目录，按 VitePress 的同一个结构写进
 * HTML（`.VPDocOutlineItem root/nested` + `.outline-link`，并沿用产物里的 `data-v-*` 作用域属性，
 * 否则 scoped 样式匹配不上）。条目就是普通 `#锚点`，`file://` 下原生跳转，不需要 JS；
 * 只有「滚动高亮 / 指示条」这个装饰在离线副本里没有。
 */
const OUTLINE_LEVELS = [2, 3]
const IGNORE_RE = /\b(?:VPBadge|header-anchor|footnote-ref|ignore-header)\b/
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }

const decodeEntities = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (!code.startsWith('#')) return ENTITIES[code.toLowerCase()] ?? whole
    const point = /^#x/i.test(code) ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1))
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : whole
  })

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// 标题文字：先整段去掉「标记类」行内元素（header-anchor 的零宽空格就在里面），再剥标签、解实体。
const headingText = (inner) =>
  decodeEntities(
    inner
      .replace(/<([a-z][a-z0-9-]*)\b([^>]*)>[\s\S]*?<\/\1>/gi, (whole, _tag, attrs) =>
        IGNORE_RE.test(/class="([^"]*)"/.exec(attrs)?.[1] ?? '') ? '' : whole)
      .replace(/<[^>]*>/g, ''),
  ).replace(/\s+/g, ' ').trim()

// 与主题里的 buildTree 同构：深一级挂到前一个更浅的标题下面，落在 [min, max] 之外的丢掉，
// 带 ignore-header 的标题连同其后代一起丢。
function outlineTree(headings) {
  const roots = []
  const stack = []
  for (const heading of headings) {
    const node = { ...heading, children: [] }
    let parent = stack.at(-1)
    while (parent !== undefined && parent.level >= node.level) {
      stack.pop()
      parent = stack.at(-1)
    }
    if (node.ignore || parent?.shouldIgnore === true) {
      stack.push({ level: node.level, shouldIgnore: true })
      continue
    }
    if (node.level < OUTLINE_LEVELS[0] || node.level > OUTLINE_LEVELS[1]) continue
    if (parent) parent.children.push(node)
    else roots.push(node)
    stack.push(node)
  }
  return roots
}

const OUTLINE_UL_RE = /<ul class="VPDocOutlineItem root"([^>]*)>[\s\S]*?<\/ul>/

function injectOutline(html) {
  const root = OUTLINE_UL_RE.exec(html)
  if (root === null) return html // 首页 / 404：没有右栏
  const scoped = root[1].match(/ data-v-[0-9a-f]+(?:="")?/g) ?? []
  if (scoped.length === 0) return html // 认不出作用域属性就宁可不动

  const main = /<main\b[\s\S]*?<\/main>/.exec(html)?.[0] ?? ''
  const headings = []
  for (const [, level, attrs, inner] of main.matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/g)) {
    const id = /\bid="([^"]*)"/.exec(attrs)?.[1]
    // 与主题的 `el.id && el.hasChildNodes()` 对齐：没 id、或标题是空的，都不进目录。
    if (id === undefined || /^\s*$/.test(inner)) continue
    headings.push({ level: Number(level), id, ignore: /\bignore-header\b/.test(attrs), title: headingText(inner) })
  }
  const roots = outlineTree(headings)
  if (roots.length === 0) return html

  const own = scoped.at(-1) // 组件自己的作用域：`.outline-link` 的样式靠它匹配
  const all = scoped.join('')
  const render = (nodes) =>
    nodes
      .map((node) => {
        const kids = node.children.length > 0
          ? `<ul class="VPDocOutlineItem nested"${all}>${render(node.children)}</ul>`
          : ''
        const title = escapeHtml(node.title)
        return `<li><a class="outline-link"${own} href="#${escapeHtml(node.id)}" title="${title}">${title}</a>${kids}</li>`
      })
      .join('')

  return html
    .replace(OUTLINE_UL_RE, (_whole, attrs) => `<ul class="VPDocOutlineItem root"${attrs}>${render(roots)}</ul>`)
    .replace('class="VPDocAsideOutline"', 'class="VPDocAsideOutline has-outline"')
}

rmSync(out, { recursive: true, force: true })
let pages = 0
const walk = (from, to, depth) => {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name)
    const dst = join(to, entry.name)
    if (entry.isDirectory()) {
      walk(src, dst, depth + 1)
      continue
    }
    if (!entry.name.endsWith('.html')) {
      copyFileSync(src, dst)
      continue
    }
    const prefix = depth === 0 ? './' : '../'.repeat(depth)
    const html = injectOutline(
      readFileSync(src, 'utf8')
        .split(`="${base}`).join(`="${prefix}`)
        .replace(/<script type="module"[^>]*><\/script>/g, '')
        .replace(/<link rel="modulepreload"[^>]*>/g, '')
        // ② 注入摊开侧栏的样式（见 UNFOLD_CSS 的说明）。
        .replace('</head>', `<style>${UNFOLD_CSS}</style></head>`)
        // ① base 换成相对之后，还有一类链接以 `/` 结尾（`../examples/`、`../`）：http 下由服务器
        //    补成 `index.html`，`file://` 下没人补——双击就落到「目录索引」（浏览器列的文件夹）。
        //    这里显式补上。只碰站内相对链接：带协议（`https:`）与协议相对（`//`）的一律放过。
        .replace(/href="([^"]*\/)"/g, (whole, path) =>
          /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path) ? whole : `href="${path}index.html"`),
    )
    writeFileSync(dst, html)
    pages += 1
  }
}
walk(dist, out, 0)
console.log(`[offline] 已生成 ${out}（${pages} 页）——双击 index.html 即可，无需服务器`)
console.log('[offline] 提示：预渲染内容与样式都在，侧栏折叠组已摊开、右栏「本页目录」已按构建期算好写进页面；搜索 / 主题切换 / 滚动高亮等 JS 功能在 file:// 下不可用（浏览器的模块脚本限制）。')
