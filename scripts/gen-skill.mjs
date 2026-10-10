// 技能文档的清单段生成器：把 SKILL.md 里「可用 API」与「实测缺失」两段由三态表生成，
// 让技能文档与表永远同步（此前手写清单已经漂过：表里 41 个 ok 方法，文档只列了 32 个）。
//
// 运行：node scripts/gen-skill.mjs（在本包目录下）
// 约定：**改表 / 重跑探针后紧接着跑本脚本**。SKILL.md 由 Host 运行时读盘注册（不进构建产物），
//       所以不需要重建 client.js / core.js。
//
// 只生成「清单类」内容——写法叙述、示例、纪律、改写建议都是人写的，不在这里。
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { corpusRoot } from '../src/host/corpus.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mapPath = join(root, 'src/core/py/api-map.generated.ts')
const skillPath = join(root, 'skills/manim-renderer/SKILL.md')

const source = readFileSync(mapPath, 'utf8')
const match = source.match(/PY_API_MAP: Record<string, PyApiEntry> = (\{[\s\S]*?\n\})\n/)
if (match === null) throw new Error(`没能从 ${mapPath} 里读到 PY_API_MAP`)
const map = JSON.parse(match[1])

const animateMatch = source.match(/PY_ANIMATE_METHODS: string\[\] = (\[[\s\S]*?\n\])\n/)
if (animateMatch === null) throw new Error(`没能从 ${mapPath} 里读到 PY_ANIMATE_METHODS`)
const animateMethods = JSON.parse(animateMatch[1])

// animate 链的改写表在支持面（surface.ts）里——代理上没有、要换成 manim-web 真名的那些
// （如 ValueTracker 的 set_value → animateTo），也要进技能文档的可用清单，否则模型不敢用。
// 这张表是**手写 TS**（单引号、无引号键名），不是生成物，所以按条目正则读，不走 JSON.parse。
const surfacePath = join(root, 'src/core/py/surface.ts')
const rewriteBlock = readFileSync(surfacePath, 'utf8').match(
  /ANIMATE_REWRITES: Record<string, string> = \{([\s\S]*?)\n\}/,
)
if (rewriteBlock === null) throw new Error(`没能从 ${surfacePath} 里读到 ANIMATE_REWRITES`)
const animateRewrites = Object.fromEntries(
  [...rewriteBlock[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*'([^']+)'/g)].map(([, from, to]) => [from, to]),
)

// 抽象基类：表里记 ok，但构造即抛（Polyhedron → this._createGeometry is not a function）。
// 它们的名字要从「可用清单」挪进「实测缺失」，否则模型照文档写 Polyhedron() 会撞上一个
// 完全看不懂的内部错。与适配层的存根**同源**（都读 surface.ts 这一张表），不会各说各话。
const abstractMatch = readFileSync(surfacePath, 'utf8').match(
  /ABSTRACT_CLASSES: Record<string, string> = \{([\s\S]*?)\n\}/,
)
if (abstractMatch === null) throw new Error(`没能从 ${surfacePath} 里读到 ABSTRACT_CLASSES`)
const abstracts = Object.fromEntries(
  [...abstractMatch[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*'([^']*)'/g)].map(([, name, alt]) => [name, alt]),
)

const entries = Object.entries(map)
const of = (...states) => entries.filter(([, entry]) => states.includes(entry.state))
const names = (list) => list.map(([name]) => name)
const ticks = (list) => list.map((name) => `\`${name}\``).join(' ')

const ok = of('ok').filter(([name]) => abstracts[name] === undefined)
const alias = of('alias')
const missing = of('missing')

const pick = (list, kind) => names(list.filter(([, entry]) => entry.kind === kind))

/** 可用 API：按类型分组的名字清单。 */
function apiList() {
  const lines = []
  const line = (label, list) => {
    if (list.length > 0) lines.push(`**${label}**：${ticks(list)}`)
  }
  line('图形与组合', pick(ok, 'class'))
  line('动画', pick(ok, 'anim'))
  line('方法', pick(ok, 'method'))
  line('场景方法', pick(ok, 'scene-method'))
  line('函数', pick(ok, 'function'))
  line('常量', pick(ok, 'const'))
  line('速率', pick(ok, 'rate'))
  line('颜色', pick(ok, 'color'))
  if (alias.length > 0) {
    const mapped = alias.map(([name, entry]) => `\`${name}\` → ${entry.js ?? '—'}`).join('；')
    // alias = 适配层能翻译的写法（照 CE 写就对），不是「要改写」
    lines.push(`**照 CE 写、适配层自动翻译**：${mapped}`)
  }
  return lines.join('\n')
}

/** 实测缺失：紧凑分组列出（只点名字，改法见上面的建议表）。 */
function missingList() {
  const lines = []
  const line = (label, list) => {
    if (list.length > 0) lines.push(`- **${label}**：${ticks(list)}`)
  }
  line('类 / 形状', pick(missing, 'class'))
  line('动画', pick(missing, 'anim'))
  line('方法', pick(missing, 'method'))
  line('函数', pick(missing, 'function'))
  line('速率函数', pick(missing, 'rate'))
  line('常量', pick(missing, 'const'))
  // 抽象基类（表里 ok、构造即抛）：连替代写法一起写出来——这一族没有「建议表」可查。
  const abstractNames = Object.entries(abstracts)
  if (abstractNames.length > 0) {
    lines.push(`- **抽象基类（有名字但不能直接构造）**：${abstractNames.map(([name, alt]) => `\`${name}\`（${alt}）`).join('；')}`)
  }
  return lines.join('\n')
}

/** animate 链白名单：探针实测的代理方法 + 支持面里的改写名（改写名也是能用的写法）。 */
function animateMethodList() {
  return ticks([...animateMethods, ...Object.keys(animateRewrites)])
}

/**
 * 场景模板：把语料里 `lesson/` 那组的完整文件**原样内联**进技能。
 *
 * 为什么内联而不是让模型自己去读文件：技能是整段正文注册的，模型一次就拿到全部，
 * 不必再赌它有文件访问权。这些文件同时是实验场的语料（回归跑过），所以内联的是**验过的**写法。
 * 语料本体在插件仓 `_dev/`（**包外**，语料位置与解析见 src/host/corpus.js）——所以这一步只能在
 * 仓库检出里跑，正式安装里没有这条路径。
 */
function templatesSection() {
  const dir = join(corpusRoot(), 'lesson')
  const fence = '```'
  return readdirSync(dir)
    .filter((name) => name.endsWith('.py'))
    .sort()
    .map((name) => {
      const text = readFileSync(join(dir, name), 'utf8')
      const header = text.match(/^"""([\s\S]*?)"""/)
      const title =
        (header?.[1] ?? '')
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line !== '' && !line.startsWith('@')) ?? name
      return `### ${title}（\`${name}\`）\n\n${fence}python\n${text.trimEnd()}\n${fence}`
    })
    .join('\n\n')
}

/** 把标记块之间的内容换成生成结果（幂等）。 */
function replaceBlock(text, marker, body) {
  const open = `<!-- gen:${marker} -->`
  const close = `<!-- /gen:${marker} -->`
  const start = text.indexOf(open)
  const end = text.indexOf(close)
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`${skillPath} 里找不到 <!-- gen:${marker} --> / <!-- /gen:${marker} --> 标记块`)
  }
  return `${text.slice(0, start + open.length)}\n${body}\n${text.slice(end)}`
}

const before = readFileSync(skillPath, 'utf8')
const after = replaceBlock(
  replaceBlock(
    replaceBlock(replaceBlock(before, 'api-list', apiList()), 'missing', missingList()),
    'animate-methods',
    animateMethodList(),
  ),
  'templates',
  templatesSection(),
)
writeFileSync(skillPath, after)

console.log(
  `技能文档清单段已更新：${skillPath}\n` +
    `  可用：class ${pick(ok, 'class').length} / anim ${pick(ok, 'anim').length} / method ${pick(ok, 'method').length} / ` +
    `scene-method ${pick(ok, 'scene-method').length} / function ${pick(ok, 'function').length} / const ${pick(ok, 'const').length} / ` +
    `rate ${pick(ok, 'rate').length} / color ${pick(ok, 'color').length}；alias ${alias.length}\n` +
    `  缺失：${missing.length} 项（另 ${Object.keys(abstracts).length} 项抽象基类）`,
)
