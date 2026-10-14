// 技能文档的清单段生成器：把 SKILL.md 里「可用 API」与「实测缺失」两段由三态表生成，
// 让技能文档与表永远同步（此前手写清单已经漂过：表里 41 个 ok 方法，文档只列了 32 个）。
//
// 运行：node scripts/gen-skill.mjs（在本包目录下）
// 约定：**改表 / 重跑探针后紧接着跑本脚本**。SKILL.md 由 Host 运行时读盘注册（不进构建产物），
//       所以不需要重建 client.js。
//
// 只生成「清单类」内容——写法叙述、示例、纪律、改写建议都是人写的，不在这里。
//
// 跨仓取数（顶层设计 §10 方案 A）：三态表、支持面、语料**都不是本仓的**，它们在核心包
// `manim-live` 里。本脚本按模块解析拿它的包根（`PACKAGE_ROOT` 由核心包自己算），再按路径读源码——
// 与「语料在包外、正式安装里读不到」完全同构，不新增概念。核心包改目录结构时这里会当场报错，
// 不会静默生成一份过期的技能。
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PACKAGE_ROOT as CORE_ROOT, collectCorpus } from 'manim-live/node'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mapPath = join(CORE_ROOT, 'src/py/api-map.generated.ts')
const skillPath = join(root, 'skills/manim-live/SKILL.md')

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
const surfacePath = join(CORE_ROOT, 'src/py/surface.ts')
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

// 扩展车道（manim_live_extra）的名字表：与三态表同源生成，进技能文档的扩展段。
const extrasPath = join(CORE_ROOT, 'src/py/extras-map.generated.ts')
const extrasMatch = readFileSync(extrasPath, 'utf8').match(/EXTRA_API_MAP: Record<string, ExtraApiEntry> = (\{[\s\S]*?\n\})\n/)
if (extrasMatch === null) throw new Error(`没能从 ${extrasPath} 里读到 EXTRA_API_MAP`)
const extras = Object.keys(JSON.parse(extrasMatch[1]))

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

/** 扩展车道清单：名字一行（签名与用法是手写的，见 SKILL.md 扩展节）。表空时返回空串——段落留白即「无扩展」。 */
function extrasList() {
  return ticks(extras)
}

/**
 * 场景模板：只内联 docstring 里带 `@template <理由>` 标记的语料，**原样**贴进技能。
 *
 * 为什么按标记精选而不是整组内联：模板区是给模型照抄的范本，多了会稀释注意力、
 * 少了覆盖不住讲解范式——「哪条够格」是个判断，判断就写在标记后面（`@template 什么时候照它抄`）。
 * 想增删模板就改语料文件的标记，这里不做任何二次筛选。
 *
 * 为什么内联而不是让模型自己去读文件：技能是整段正文注册的，模型一次就拿到全部，
 * 不必再赌它有文件访问权。这些文件同时是回归网的语料（回归跑过 + 真浏览器截过图），
 * 所以内联的是**验过的**写法。
 * 语料本体在**核心包**仓的 `corpus/examples/`（**包外**，位置与解析见核心包的
 * `src/testbench/corpus.ts`）——所以这一步只能在两个仓都检出的开发机上跑，
 * 正式安装里没有这条路径。
 */
function templatesSection() {
  const { groups, examples } = collectCorpus()
  const groupTitle = new Map(groups.map((group) => [group.id, group.title]))
  const chosen = examples.filter((example) => example.template !== undefined)
  if (chosen.length === 0) {
    throw new Error('没有任何语料带 @template 标记——模板区会是空的，先去 corpus/examples 里选几条')
  }
  const fence = '```'
  return chosen
    .map((example) => {
      const name = example.file.split('/').pop()
      const from = groupTitle.get(example.group) ?? example.group
      return (
        `### ${example.title}（\`${name}\`，出自「${from}」组）\n\n` +
        `**什么时候照它抄**：${example.template}\n\n` +
        `${fence}python\n${example.python.trimEnd()}\n${fence}`
      )
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
    replaceBlock(
      replaceBlock(
        replaceBlock(before, 'api-list', apiList()),
        'missing',
        missingList(),
      ),
      'animate-methods',
      animateMethodList(),
    ),
    'templates',
    templatesSection(),
  ),
  'extras-list',
  extrasList(),
)
writeFileSync(skillPath, after)

console.log(
  `技能文档清单段已更新：${skillPath}\n` +
    `  可用：class ${pick(ok, 'class').length} / anim ${pick(ok, 'anim').length} / method ${pick(ok, 'method').length} / ` +
    `scene-method ${pick(ok, 'scene-method').length} / function ${pick(ok, 'function').length} / const ${pick(ok, 'const').length} / ` +
    `rate ${pick(ok, 'rate').length} / color ${pick(ok, 'color').length}；alias ${alias.length}\n` +
    `  缺失：${missing.length} 项（另 ${Object.keys(abstracts).length} 项抽象基类）\n` +
    `  扩展车道：${extras.length} 个（manim_live_extra）`,
)
