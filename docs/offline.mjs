#!/usr/bin/env node
// 离线副本：把 VitePress 的 dist 转成「双击就能看」的一份（不起服务器）。
//
// 为什么直开 dist 不行（三条独立原因，都会真实发生）：
//   ① 资源是**绝对 base**（`/仓名/assets/…`，为 GitHub Pages 而设）——`file://` 下它们指向
//      **文件系统根**，样式表/图片全 404，侧栏链接也全断；
//   ② 浏览器禁止从 `file://` 加载 **ES module**（CORS），VitePress 运行时（搜索 / 主题切换 /
//      SPA 切页）永远跑不起来；
//   ③ 侧栏折叠组靠 JS 开合、目录链接靠服务器补 `index.html`——脚本剥掉、服务器没有之后，
//      折叠的组点不开、以 `/` 结尾的链接会落到「目录索引」。
// 本脚本把 ① 改成**按页面所在深度相对**（站内链接因此点得动），把 ② 的 module 脚本剥掉
// （留着只会在控制台刷 CORS 报错），并针对 ③ 补 `index.html` + 注入摊开侧栏的 CSS。
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
    const html = readFileSync(src, 'utf8')
      .split(`="${base}`).join(`="${prefix}`)
      .replace(/<script type="module"[^>]*><\/script>/g, '')
      .replace(/<link rel="modulepreload"[^>]*>/g, '')
      // ② 注入摊开侧栏的样式（见 UNFOLD_CSS 的说明）。
      .replace('</head>', `<style>${UNFOLD_CSS}</style></head>`)
      // ① base 换成相对之后，还有一类链接以 `/` 结尾（`../examples/`、`../`）：http 下由服务器
      //    补成 `index.html`，`file://` 下没人补——双击就落到「目录索引」（浏览器列的文件夹）。
      //    这里显式补上。只碰站内相对链接：带协议（`https:`）与协议相对（`//`）的一律放过。
      .replace(/href="([^"]*\/)"/g, (whole, path) =>
        /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path) ? whole : `href="${path}index.html"`)
    writeFileSync(dst, html)
    pages += 1
  }
}
walk(dist, out, 0)
console.log(`[offline] 已生成 ${out}（${pages} 页）——双击 index.html 即可，无需服务器`)
console.log('[offline] 提示：预渲染内容与样式都在，侧栏折叠组已自动摊开；搜索 / 主题切换等 JS 功能在 file:// 下不可用（浏览器的模块脚本限制）。')
