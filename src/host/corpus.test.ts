/**
 * 语料读取（Host 半边）：位置解析、形状解析，以及**开发机上配置错时必须报错**。
 *
 * 为什么单独测这个模块：它是「语料在包外 `_dev/`」这条设计的落点——浏览器里的实验场、Node 回归、
 * 技能模板生成三处都从这里拿语料。这里错了，三处一起错，而且症状是「页面空了」这种很难倒查的表现。
 *
 * 用临时目录造语料（`MANIM_CORPUS` 指过去）来验解析与报错；再顺手钉住真语料的两条契约
 * （分组登记齐全、net 组标了需联网）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GROUPS, REPO_ROOT, collectCorpus, corpusAvailable, corpusRoot } from './corpus.js'

const original = process.env.MANIM_CORPUS
const made = []

/** 往某个分组里写一个条目。 */
function entry(root, group, name, body) {
  mkdirSync(join(root, group), { recursive: true })
  writeFileSync(join(root, group, name), body)
}

/**
 * 造一份临时语料并把它设成当前语料根。
 *
 * 必须是「齐全」的：每个登记过的分组都要有目录，缺哪个 `collectCorpus` 会当场炸
 * （那是有意的守卫，见下面「配置错了要当场炸」）。所以先铺满占位条目，调用方再增删。
 */
function useCorpus(add?: (root: string) => void): string {
  const root = mkdtempSync(join(tmpdir(), 'manim-corpus-'))
  made.push(root)
  for (const group of GROUPS) entry(root, group.id, '01-stub.py', `"""${group.id} 占位"""\n`)
  add?.(root)
  process.env.MANIM_CORPUS = root
  return root
}

afterEach(() => {
  if (original === undefined) delete process.env.MANIM_CORPUS
  else process.env.MANIM_CORPUS = original
  for (const root of made.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('语料位置', () => {
  it('默认在插件仓 _dev/ 下（包外），且开发机上确实有', () => {
    delete process.env.MANIM_CORPUS
    expect(corpusRoot()).toBe(join(REPO_ROOT, '_dev', 'examples'))
    expect(corpusAvailable()).toBe(true)
  })

  it('MANIM_CORPUS 覆盖位置', () => {
    const root = useCorpus()
    expect(corpusRoot()).toBe(root)
    expect(corpusAvailable()).toBe(true)
  })
})

describe('语料解析', () => {
  it('目录不在 = 空表（正式安装的常态），不抛', () => {
    process.env.MANIM_CORPUS = join(tmpdir(), 'manim-corpus-does-not-exist')
    expect(corpusAvailable()).toBe(false)
    expect(collectCorpus()).toEqual({ groups: [], examples: [] })
  })

  it('条目带齐 id / 分组 / 期望 / 源码，@reject 与 @note 从 docstring 里取', () => {
    useCorpus((dir) => {
      entry(dir, 'basic', '02-plain.py', '"""普通一条\n\n@note 出处在这\n"""\n\nprint(1)\n')
      entry(dir, 'basic', '03-bad.py', '"""会被拒\n\n@reject Table\n"""\n\nprint(2)\n')
      entry(dir, 'basic', '04-want.py', '"""有预期\n\n@expect 圆是青色的\n@note 视觉核对\n"""\n\nprint(3)\n')
      entry(dir, 'basic', '05-browser.py', '"""要浏览器\n\n@browser\n"""\n\nprint(4)\n')
    })
    const { groups, examples } = collectCorpus()
    expect(groups.map((group) => group.id)).toEqual(GROUPS.map((group) => group.id))
    expect(groups.find((group) => group.id === 'basic')).toEqual({ id: 'basic', title: GROUPS[0].title })

    const plain = examples.find((item) => item.id === 'basic-plain')
    // 排序前缀 NN- 不进 id；docstring 第一行是标题
    expect(plain).toMatchObject({ group: 'basic', title: '普通一条', expect: 'ok', note: '出处在这' })
    expect(plain?.python).toContain('print(1)')

    // @expect：预期表现单独成字段——「跑通」只说明没炸，画得对不对要对着这句核
    const want = examples.find((item) => item.id === 'basic-want')
    expect(want).toMatchObject({ expectation: '圆是青色的' })

    const bad = examples.find((item) => item.id === 'basic-bad')
    expect(bad).toMatchObject({ expect: 'reject', errorIncludes: 'Table' })

    // @browser：只能真浏览器跑（Node 无 DOM）——Node 套件据此跳过，页面照跑
    const browser = examples.find((item) => item.id === 'basic-browser')
    expect(browser).toMatchObject({ browser: true, expect: 'ok' })
    expect(plain?.browser).toBeUndefined()
  })

  it('file 是能照着找的路径：仓内相对仓根', () => {
    delete process.env.MANIM_CORPUS
    const one = collectCorpus().examples[0]
    expect(one?.file.startsWith('_dev/examples/')).toBe(true)
    expect(one?.file.endsWith('.py')).toBe(true)
  })

  it('语料指到仓外时 file 退化成绝对路径（相对路径会是一串 ..）', () => {
    const root = useCorpus()
    const one = collectCorpus().examples.find((item) => item.group === 'basic')
    expect(one?.file).toBe(join(root, 'basic', '01-stub.py').split('\\').join('/'))
  })
})

describe('语料配置错了要当场炸（静默漏掉更糟）', () => {
  it('目录里有没登记的分组', () => {
    useCorpus((dir) => mkdirSync(join(dir, 'brand-new-group')))
    expect(() => collectCorpus()).toThrow(/未登记的分组：brand-new-group/)
  })

  it('登记了分组但目录没建', () => {
    useCorpus((dir) => rmSync(join(dir, 'lesson'), { recursive: true, force: true }))
    expect(() => collectCorpus()).toThrow(/lesson\/ 目录不存在/)
  })

  it('分组目录是空的', () => {
    useCorpus((dir) => {
      rmSync(join(dir, 'basic'), { recursive: true, force: true })
      mkdirSync(join(dir, 'basic'))
    })
    expect(() => collectCorpus()).toThrow(/basic\/ 里没有 \.py/)
  })

  it('缺开头的模块 docstring', () => {
    useCorpus((dir) => entry(dir, 'basic', '09-nodoc.py', 'print(1)\n'))
    expect(() => collectCorpus()).toThrow(/缺少开头的模块 docstring/)
  })
})

describe('真语料的契约', () => {
  it('每个分组都有条目；需联网分组整组标了 network，且各有拒绝用例', () => {
    delete process.env.MANIM_CORPUS
    const { groups, examples } = collectCorpus()
    expect(groups.map((group) => group.id)).toEqual(GROUPS.map((group) => group.id))
    for (const group of groups) {
      expect(examples.some((item) => item.group === group.id), `${group.id} 里没有语料`).toBe(true)
    }
    // 条目上的 network 必须与它所属分组的登记一致——不一致会让自动测试把联网件当离线件跑
    const networkGroups = new Set(
      GROUPS.filter((group) => group.network === true).map((group) => group.id),
    )
    expect(networkGroups.size).toBeGreaterThan(0)
    expect(examples.every((item) => (item.network === true) === networkGroups.has(item.group))).toBe(true)
    // 需联网的两组各要一条拒绝用例：net 验「包取不到」，combo 验「多库链路里撞到缺失 API」
    for (const id of ['net', 'combo']) {
      expect(networkGroups.has(id), `${id} 应当是需联网分组`).toBe(true)
      const items = examples.filter((item) => item.group === id)
      expect(items.some((item) => item.expect === 'reject'), `${id} 里没有拒绝用例`).toBe(true)
    }
    // 离线组（syntax）不标 network：它们在默认套件里就跑
    expect(examples.filter((item) => item.group === 'syntax').every((item) => item.network === undefined)).toBe(true)
  })
})
