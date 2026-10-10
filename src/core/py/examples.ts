/**
 * 实验场语料的**形状**：类型 + 边界校验。
 *
 * 语料本体在插件仓 `_dev/examples/`——**不进发布集**（位置与解析见 `src/host/corpus.js`）。
 * 为什么留在包外：这批文件是**开发期的回归网**，不是产品功能——跟着插件发布等于把上百条源码
 * 打进 `client.js`，还让每个用户看到一个只有开发者才用的实验场。所以浏览器侧改成**运行时向 Host 取**
 * （`GET /dsh-plugins/manim-renderer/corpus`）：仓库检出里读得到，正式安装里读不到，
 * 实验场就退化成「自定义代码」那一半。
 *
 * 于是 `parseCorpus` 有实职：HTTP 响应是**不可信输入**（Host 版本对不上、代理插话、手改包都可能
 * 让形状歪掉），坏数据一律当「没有语料」，不能拿脏数据把页面搞崩。Node 侧（回归测试）拿到的是
 * `collectCorpus()` 的直接产物，不经过这里。
 */

/** 期望：跑通，还是被当场拒掉。 */
export type ExampleExpect = 'ok' | 'reject'

export interface ManimExample {
  /** 稳定 id：分组 + 文件名（去掉排序前缀），同时是页面 key 与测试名。 */
  id: string
  /** 分组 id = 语料根下的一级目录名。 */
  group: string
  /** 语料文件相对**仓库根**的路径——报错回执按它就能直接定位。 */
  file: string
  /** 一句话说明这条在验什么（取自文件 docstring 第一行）。 */
  title: string
  expect: ExampleExpect
  /** expect='reject' 时，报错里必须出现的词——钉住「拒了、而且说清楚了」。 */
  errorIncludes?: string
  /** 需要联网取包（第三方库那组）：默认不进自动测试，设 MANIM_NET=1 才跑。 */
  network?: boolean
  /**
   * 只能在**真浏览器**里跑（要 DOM / WebGL，如 SVGMobject 要 DOMParser）：
   * Node 套件跳过它（跳过会写进日志），改由实验场页面核——不留「静默漏跑」。
   */
  browser?: boolean
  /** 完整 Manim 源码（含 import 与 class），逐字取自 .py 文件。 */
  python: string
  /** 出处：为什么有这条（取自 docstring 的 @note）。 */
  note?: string
  /** 预期表现（取自 docstring 的 @expect）：跑通只说明没炸，画得对不对要对着这句核。 */
  expectation?: string
}

export interface ExampleGroup {
  id: string
  title: string
  /** 整组都要联网取包：页面上给个「需联网」标记，测试里默认跳过。 */
  network?: boolean
}

export interface Corpus {
  groups: ExampleGroup[]
  examples: ManimExample[]
}

const EMPTY: Corpus = { groups: [], examples: [] }

const optionalString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

/** 一条语料：id / group / file / title / python 必须齐全，expect 只能是那两个字面量。 */
function readExample(value: unknown): ManimExample | null {
  if (value === null || typeof value !== 'object') return null
  const bag = value as Record<string, unknown>
  const id = optionalString(bag.id)
  const group = optionalString(bag.group)
  const file = optionalString(bag.file)
  const title = optionalString(bag.title)
  const python = optionalString(bag.python)
  if (id === undefined || group === undefined || file === undefined) return null
  if (title === undefined || python === undefined) return null
  if (bag.expect !== 'ok' && bag.expect !== 'reject') return null
  const errorIncludes = optionalString(bag.errorIncludes)
  const note = optionalString(bag.note)
  const expectation = optionalString(bag.expectation)
  return {
    id,
    group,
    file,
    title,
    expect: bag.expect,
    python,
    ...(errorIncludes === undefined ? {} : { errorIncludes }),
    ...(bag.network === true ? { network: true } : {}),
    ...(bag.browser === true ? { browser: true } : {}),
    ...(note === undefined ? {} : { note }),
    ...(expectation === undefined ? {} : { expectation }),
  }
}

function readGroup(value: unknown): ExampleGroup | null {
  if (value === null || typeof value !== 'object') return null
  const bag = value as Record<string, unknown>
  const id = optionalString(bag.id)
  const title = optionalString(bag.title)
  if (id === undefined || title === undefined) return null
  return { id, title, ...(bag.network === true ? { network: true } : {}) }
}

/** 把（不可信的）语料响应收成 Corpus；形状不对就当成「没有语料」。 */
export function parseCorpus(value: unknown): Corpus {
  if (value === null || typeof value !== 'object') return EMPTY
  const bag = value as Record<string, unknown>
  if (!Array.isArray(bag.groups) || !Array.isArray(bag.examples)) return EMPTY
  const groups = bag.groups.map(readGroup).filter((group): group is ExampleGroup => group !== null)
  const examples = bag.examples.map(readExample).filter((item): item is ManimExample => item !== null)
  if (groups.length === 0) return EMPTY
  // 只在登记过的分组里的条目才认——否则页面上会出现点不开的孤儿
  const known = new Set(groups.map((group) => group.id))
  return { groups, examples: examples.filter((item) => known.has(item.group)) }
}
