/**
 * 子路径记账自检与治疗的回归网。
 *
 * ⚠️ 这个 bug **只有真浏览器才复现**（真 WebGL + 真 KaTeX 的 SVG 字形路径）：Node 侧的
 * `upstream-fixes.test.ts` 里同样跑「同一个 MathTex 连续 morph 两次」是**过得去**的——
 * KaTeX 在 Node 里不走同一条路径，坏不掉那套记账。所以真机的验收只能靠本地那台真渲染自查台
 * （`_tmp/selfcheck/`，不进 git：真 Pyodide + 真 manim-web browser 构建 + 真 WebGL + 真 KaTeX），
 * 这里钉的是**判据本身**：什么时候算对不上、什么时候该治、治完要自洽。
 *
 * 事故的形状（真机实测）：`Transform(n4, n8)` 之后紧跟 `Transform(n4, n20)`，
 * 第二段抛 `alignVmobjectPair(source): subpath lengths sum (74) does not match point count (72)`。
 * 顶层 VGroup 自己是干净的（没有记账），坏的是它内部的字形子物——所以「要走进子物」这条最要紧。
 */
import { describe, expect, it } from 'vitest'
import { healSubpathBookkeeping, subpathsConsistent, subpathTreeConsistent } from './subpath-bookkeeping.ts'

/** 假物体：只带记账那几方法，够复现真机那几种状态。 */
function fake(points: number, options: {
  transform?: readonly number[]
  base?: readonly number[]
  children?: readonly unknown[]
} = {}) {
  let transform = options.transform
  let base = options.base
  return {
    getLocalPoints: () => Array.from({ length: points }, () => [0, 0, 0]),
    getEffectiveSubpathLengths: () => transform ?? base,
    getSubpathLengths: () => base,
    setTransformSubpathLengths: (value?: readonly number[]) => {
      transform = value === undefined ? undefined : [...value]
    },
    setBaseSubpathLengths: (value?: readonly number[]) => {
      base = value === undefined ? undefined : [...value]
    },
    children: options.children,
    read: () => ({ transform, base, effective: transform ?? base }),
  }
}

describe('subpathsConsistent：一个物体的记账对不对得上点数', () => {
  it('压根没有记账 → 自洽（上游会走 alignPoints 兜底，不该拦）', () => {
    expect(subpathsConsistent(fake(72))).toBe(true)
    expect(subpathsConsistent(fake(72, { base: [] }))).toBe(true)
  })

  it('长度之和等于点数 → 自洽', () => {
    expect(subpathsConsistent(fake(72, { base: [18, 18, 18, 18] }))).toBe(true)
  })

  it('长度之和与点数不等 → 不自洽（真机那条 74 vs 72）', () => {
    expect(subpathsConsistent(fake(72, { transform: [74] }))).toBe(false)
    expect(subpathsConsistent(fake(72, { base: [36, 38] }))).toBe(false)
  })

  it('生效值是 transform ?? base —— transform 盖住 base', () => {
    expect(subpathsConsistent(fake(74, { transform: [74], base: [72] }))).toBe(true)
    expect(subpathsConsistent(fake(72, { transform: [74], base: [72] }))).toBe(false)
  })

  it('不是物体（null / 裸值 / 没这几个方法）→ 自洽，别炸', () => {
    for (const value of [null, undefined, 42, 'x', {}]) {
      expect(subpathsConsistent(value), JSON.stringify(value)).toBe(true)
    }
  })
})

describe('subpathTreeConsistent：要走进子物（顶层干净不代表没事）', () => {
  it('顶层干净、子物对不上 → 整棵树判不自洽', () => {
    const tree = fake(207, { children: [fake(72, { transform: [74] })] })
    expect(subpathsConsistent(tree), '顶层自己看是干净的').toBe(true)
    expect(subpathTreeConsistent(tree)).toBe(false)
  })

  it('孙子那层坏也一样抓得到', () => {
    const tree = fake(207, { children: [fake(100, { children: [fake(72, { transform: [74] })] })] })
    expect(subpathTreeConsistent(tree)).toBe(false)
  })

  it('整棵树都自洽 → true', () => {
    const tree = fake(207, { children: [fake(72, { base: [18, 18, 18, 18] }), fake(135)] })
    expect(subpathTreeConsistent(tree)).toBe(true)
  })

  it('children 不是数组 / 含裸值 → 不往下走，也不炸', () => {
    expect(subpathTreeConsistent({ children: 'nope' })).toBe(true)
    expect(subpathTreeConsistent({ children: [null, 1, 'x'] })).toBe(true)
  })

  it('深度有上限：第 9 层起不再往下（防环、防异常结构）', () => {
    let inner = fake(1, { transform: [2] })
    for (let depth = 0; depth < 9; depth++) inner = fake(1, { children: [inner] }) as never
    expect(subpathTreeConsistent(inner)).toBe(true)
  })
})

describe('healSubpathBookkeeping：治完必须自洽', () => {
  it('先把记账退回物体自己的基准（保住了子路径怎么分）', () => {
    const child = fake(72, { transform: [74], base: [18, 18, 18, 18] })
    expect(healSubpathBookkeeping(child)).toBe(true)
    expect(child.read().transform).toEqual([18, 18, 18, 18])
    expect(subpathsConsistent(child)).toBe(true)
  })

  it('基准也对不上 → 两套一起清（只清基准不够：生效值是 transform ?? base）', () => {
    const child = fake(72, { transform: [74], base: [80] })
    expect(healSubpathBookkeeping(child)).toBe(true)
    const state = child.read()
    expect(state.transform).toBeUndefined()
    expect(state.base).toBeUndefined()
    expect(subpathsConsistent(child), '清完必须自洽').toBe(true)
  })

  it('整棵树上每个坏节点都会被治（返回改过没有）', () => {
    const tree = fake(300, {
      children: [fake(72, { transform: [74] }), fake(100, { transform: [200], base: [100] })],
    })
    expect(subpathTreeConsistent(tree)).toBe(false)
    expect(healSubpathBookkeeping(tree)).toBe(true)
    expect(subpathTreeConsistent(tree)).toBe(true)
  })

  it('本来就没坏的树不动它（不误改）', () => {
    const child = fake(72, { base: [18, 18, 18, 18] })
    const tree = fake(207, { children: [child] })
    expect(healSubpathBookkeeping(tree)).toBe(false)
    expect(child.read().base).toEqual([18, 18, 18, 18])
  })

  it('治不动时（setter 抛）不把调用方弄挂，且如实回报没改过', () => {
    const stuck = {
      getLocalPoints: () => [1, 2, 3],
      getEffectiveSubpathLengths: () => [9],
      setTransformSubpathLengths: () => { throw new Error('nope') },
      getSubpathLengths: () => undefined,
    }
    expect(() => healSubpathBookkeeping(stuck)).not.toThrow()
    expect(healSubpathBookkeeping(stuck)).toBe(false)
  })
})
