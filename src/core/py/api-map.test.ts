/**
 * 支持面表的门禁：**表里的 kind 必须与 manim-web 的实际继承链一致**。
 *
 * 这条是被真实事故逼出来的：CE 把 TracedPath / AnimatedBoundary 放在 `manim/animation/changing.py` 里，
 * 两者其实 extends VMobject。探针早期按「CE 把它挂在哪个模块下」归类，于是把它们记成动画，
 * 适配层生成 _Animation 工厂，用户的 `self.add(traced, dot)` 在渲染时炸
 * （`未知的对象句柄 <manim._Animation object at 0x...>`）。
 *
 * kind 现在由探针在无头浏览器里实测原型链生成（见 scripts/probe-api.mjs 的 lineage）。
 * 这条测试拿 manim-web 复核生成结果——没有再跑一次探针，也不会被探针自己的判定骗过。
 */
import { describe, expect, it } from 'vitest'
import * as manimModule from 'manim-web'
import { PY_API_MAP, type PyApiEntry } from './api-map.generated.ts'

const manim = manimModule as unknown as Record<string, unknown>

/** 实测这个导出是物体还是动画：沿原型链找 Mobject / Animation。测不出来回 null。 */
function lineage(name: string): 'mobject' | 'anim' | null {
  const value = manim[name]
  if (typeof value !== 'function') return null
  const proto = (value as { prototype?: object | null }).prototype
  if (proto === undefined || proto === null) return null
  const anim = (manim.Animation as { prototype: object }).prototype
  const mob = (manim.Mobject as { prototype: object }).prototype
  // 基类自己不算；动画先判（万一某个动画也继承物体，以动画为准，与探针口径一致）
  if (anim !== proto && anim.isPrototypeOf(proto)) return 'anim'
  if (mob !== proto && mob.isPrototypeOf(proto)) return 'mobject'
  return null
}

/** 表里登记为「物体或动画」且状态 ok 的项——只有这些的 kind 需要核对。 */
const declared: Array<[string, PyApiEntry]> = Object.entries(PY_API_MAP).filter(
  ([, entry]) => entry.state === 'ok' && (entry.kind === 'class' || entry.kind === 'anim'),
)

/** 其中能在 manim-web 里测出继承链的：这才是这条门禁真正核对得了的集合。 */
const checkable = declared.filter(([name]) => lineage(name) !== null)

describe('支持面表的 kind 与 manim-web 实际继承链一致', () => {
  it('可核对集合里物体与动画都有（否则这条门禁是空转）', () => {
    expect(new Set(checkable.map(([, entry]) => entry.kind))).toEqual(new Set(['class', 'anim']))
  })

  it('被 CE 分组带偏过的那两个，确实进了可核对集合', () => {
    // 它们测不出来就说明这条门禁会静默放过它们——正是当初出事的两个名字
    const names = checkable.map(([name]) => name)
    expect(names).toContain('TracedPath')
    expect(names).toContain('AnimatedBoundary')
  })

  it.each(checkable)('%s', (name, entry) => {
    // 表里记 class = 物体、记 anim = 动画；与实测的继承链对齐
    expect(entry.kind === 'anim' ? 'anim' : 'mobject').toBe(lineage(name))
  })
})
