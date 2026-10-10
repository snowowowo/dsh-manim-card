/**
 * 语料回归：语料根下每条都过一遍真管线（与实验场页面同一批文件）。
 *
 *  - expect='ok'     ：真桥必须跑通（真 Pyodide + 真 manim-web；Scene 换假画布，
 *                      与 manim-bridge.test.ts 同口径——真 Scene 要 DOM/WebGL，属 Client 半边）。
 *  - expect='reject' ：预检桥必须**当场**拒（不是拖到真桥才炸），且报错里带关键词。
 *
 * 语料本体在插件仓 `_dev/examples/`（**不进发布集**，见 src/host/corpus.js）。
 * 所以这份测试只在仓库检出里跑得动；语料缺失（如从 tarball 里跑）整份跳过并说明。
 *
 * 「第三方包」那组要**真联网取包**（首次几十 MB、几分钟），默认不进套件——
 * 设 `MANIM_NET=1` 才跑。理由：默认套件必须离线、秒级、不 flaky；那组是手动验的补充，
 * 主要靠实验场页面点着看（页面上的用例与这里逐字同一份文件）。
 *
 * 这里跑全量，页面看单条。加一条语料 = 多一条永久回归，这是「补一次钉死一次」的落点。
 */
import { describe, expect, it } from 'vitest'
import * as manimModule from 'manim-web'
import { runPython, setPyodideLoader } from './runtime.ts'
import { createManimWebBridge, type ManimNamespace } from './manim-bridge.ts'
import { createDryRunBridge } from './dry-run-bridge.ts'
import { collectCorpus } from '../../host/corpus.js'
import { testPyodideLoader } from '../../../scripts/test-pyodide.mjs'
import { parseCorpus, type ManimExample } from './examples.ts'

const manim = manimModule as unknown as ManimNamespace

// 与 runtime.test.ts 同口径：用随包的 assets/pyodide，随包件不走网络。
setPyodideLoader(testPyodideLoader('examples'))

/** 第三方包那组：默认跳过，MANIM_NET=1 才真跑（会联网取包）。 */
const NET = process.env.MANIM_NET === '1'

const corpus = collectCorpus()
if (corpus.examples.length === 0) {
  console.warn(
    '[examples] 没找到语料——它现在在插件仓 _dev/examples/（包外），' +
      '只在仓库检出里跑得动。整份跳过。',
  )
}

/** 假画布：只关心「收不收、炸不炸」，不看画出来的样子。名字要与真 Scene 对得上。 */
const fakeScene = () => ({
  add: () => {},
  remove: () => {},
  clear: () => {},
  play: async () => {},
  wait: async () => {},
})

/** 跑一遍并取回报错文案（没抛就是空串）。 */
async function captureError(example: ManimExample, real: boolean): Promise<string> {
  const bridge = real
    ? createManimWebBridge({ manim, scene: fakeScene() })
    : createDryRunBridge()
  try {
    await runPython(example.python, bridge)
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

const local = corpus.examples.filter((example) => example.network !== true)
const remote = corpus.examples.filter((example) => example.network === true)

/**
 * 只能在真浏览器跑的（SVGMobject 要 DOMParser）：Node 里没有 DOM，跑不了。
 * 不静默丢——打印出跳过的都是哪些，它们由实验场页面（真浏览器）核。
 */
const browserOnly = local.filter((example) => example.browser === true)
if (browserOnly.length > 0) {
  console.info(
    `[examples] 跳过 ${browserOnly.length} 条「只能真浏览器跑」的语料（Node 无 DOM）：` +
      browserOnly.map((example) => example.id).join(', '),
  )
}

const renderable = local.filter((example) => example.expect === 'ok' && example.browser !== true)
const rejectable = local.filter((example) => example.expect === 'reject' && example.browser !== true)

/** 语料缺失时全部跳过——不把「这台机器没有语料」报成一片红。 */
const suite = describe.skipIf(corpus.examples.length === 0)

suite('语料：应当跑通', () => {
  for (const example of renderable) {
    it(`${example.id}｜${example.title}`, async () => {
      expect(await captureError(example, true)).toBe('')
    }, 60_000)
  }
})

suite('语料：应当被预检当场拒绝', () => {
  for (const example of rejectable) {
    it(`${example.id}｜${example.title}`, async () => {
      const precheck = await captureError(example, false)
      // 预检没拦住就退一步看真桥——但仍然要拒，只是位置不对（预检缺接收者上下文，见 SSOT §5.2）
      const message = precheck === '' ? await captureError(example, true) : precheck
      expect(message, `${example.id} 应当被拒`).not.toBe('')
      expect(message).toContain(example.errorIncludes ?? '')
    }, 60_000)
  }
})

/**
 * 第三方包：真 `import`、真取包、真算。默认跳过（见文件头）。
 * 这批的价值不在「库能不能用」，而在**取包这条路**——首次联网取回、落进缓存目录、
 * 第二次直接命中；以及随包件（numpy / sympy）与按需件混在一段代码里也不打架。
 */
describe.skipIf(corpus.examples.length === 0 || !NET)('语料：第三方包（需联网，MANIM_NET=1 才跑）', () => {
  describe('应当跑通', () => {
    for (const example of remote.filter((item) => item.expect === 'ok')) {
      it(`${example.id}｜${example.title}`, async () => {
        expect(await captureError(example, true)).toBe('')
      }, 300_000)
    }
  })

  describe('应当被当场拒绝', () => {
    for (const example of remote.filter((item) => item.expect === 'reject')) {
      it(`${example.id}｜${example.title}`, async () => {
        const precheck = await captureError(example, false)
        const message = precheck === '' ? await captureError(example, true) : precheck
        expect(message, `${example.id} 应当被拒`).not.toBe('')
        expect(message).toContain(example.errorIncludes ?? '')
      }, 300_000)
    }
  })
})

/**
 * parseCorpus：语料响应的边界校验。
 *
 * 浏览器侧拿到的是 HTTP 正文——**不可信**（Host 版本对不上、代理插话、手改包都可能让形状歪）。
 * 少认一条不致命；拿脏数据把页面搞崩才是大事，所以坏形状一律当「没有语料」。
 */
describe('parseCorpus：不可信的语料响应', () => {
  const item = { id: 'a-1', group: 'a', file: 'f.py', title: 't', expect: 'ok', python: 'pass' }

  it('齐全的条目原样收下', () => {
    expect(parseCorpus({ groups: [{ id: 'a', title: 'A' }], examples: [item] })).toEqual({
      groups: [{ id: 'a', title: 'A' }],
      examples: [item],
    })
  })

  it('可选字段带上时收下（拒词 / 出处 / 需联网 / 预期表现 / 只能浏览器 / 截图）', () => {
    const corpus = parseCorpus({
      groups: [{ id: 'a', title: 'A', network: true }],
      examples: [{ ...item, expect: 'reject', errorIncludes: 'Table', note: '出处', expectation: '圆是青色的', network: true, browser: true, shot: 'a/f.png' }],
    })
    expect(corpus.examples[0]).toMatchObject({ errorIncludes: 'Table', note: '出处', expectation: '圆是青色的', network: true, browser: true, shot: 'a/f.png' })
    expect(corpus.groups[0]?.network).toBe(true)
    // 没截过的条目不该凭空长出一个地址——否则页面会去请求一张不存在的图
    expect(parseCorpus({ groups: [{ id: 'a', title: 'A' }], examples: [item] }).examples[0]?.shot).toBeUndefined()
  })

  it('缺字段 / 类型不对的条目直接丢，不牵连别的', () => {
    const corpus = parseCorpus({
      groups: [{ id: 'a', title: 'A' }],
      examples: [item, { ...item, id: 1 }, { ...item, python: undefined }, { ...item, expect: 'maybe' }, null],
    })
    expect(corpus.examples).toHaveLength(1)
  })

  it('整体形状不对 = 空语料', () => {
    for (const bad of [null, 7, 'x', [], {}, { groups: [], examples: 'x' }]) {
      expect(parseCorpus(bad), `payload=${JSON.stringify(bad)}`).toEqual({ groups: [], examples: [] })
    }
  })

  it('分组一个都没有 = 空语料（条目无处可挂）', () => {
    expect(parseCorpus({ groups: [], examples: [item] })).toEqual({ groups: [], examples: [] })
  })
})
