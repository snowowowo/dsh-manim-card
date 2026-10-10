/**
 * 实验场状态的落盘：逐条结果、极速开关、自定义代码、当前视图。
 *
 * 为什么要存：一轮「全部渲染」要跑上百条，中途崩了或者刷新了不该从头再来。
 *
 * localStorage 是**不可信输入**（用户改得动、旧版本写的也可能对不上），所以读的时候逐字段
 * 校验，坏数据一律当没存过——宁可丢一次进度，也不能拿脏数据把页面搞崩。语料集合是会变的，
 * 不认识的 id 在读出来之后再按当前语料表过滤（见 page.tsx），这里只管形状。
 */
import type { CardResult } from './components/card'

const KEY = 'manim-renderer.ground.v1'

export type GroundMode = 'examples' | 'free'

export interface GroundState {
  results: Record<string, CardResult>
  fast: boolean
  source: string
  mode: GroundMode
}

/** 一条结果必须是 `{ ok: boolean, text: string }`；其余形状丢掉。 */
function readResult(value: unknown): CardResult | null {
  if (value === null || typeof value !== 'object') return null
  const bag = value as Record<string, unknown>
  if (typeof bag.ok !== 'boolean' || typeof bag.text !== 'string') return null
  return { ok: bag.ok, text: bag.text }
}

/** 读回已保存的部分状态；没存过或存坏了都给空对象（调用方各自取默认值）。 */
export function loadGround(): Partial<GroundState> {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return {}
    const bag = parsed as Record<string, unknown>
    const out: Partial<GroundState> = {}
    if (bag.results !== null && typeof bag.results === 'object') {
      const results: Record<string, CardResult> = {}
      for (const [id, value] of Object.entries(bag.results as Record<string, unknown>)) {
        const result = readResult(value)
        if (result !== null) results[id] = result
      }
      out.results = results
    }
    if (typeof bag.fast === 'boolean') out.fast = bag.fast
    if (typeof bag.source === 'string') out.source = bag.source
    if (bag.mode === 'examples' || bag.mode === 'free') out.mode = bag.mode
    return out
  } catch (error) {
    console.error('[manim-renderer] 读取实验场记录失败:', error)
    return {}
  }
}

export function saveGround(state: GroundState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch (error) {
    console.error('[manim-renderer] 保存实验场记录失败:', error)
  }
}

export function clearGround(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch (error) {
    console.error('[manim-renderer] 清除实验场记录失败:', error)
  }
}

/**
 * 人工验证标注：用户对着动画看完之后自己标「对 / 不对」。
 *
 * 与自动结果（results）**分开存、分开清**——自动结果只说明「没炸」，画得对不对只有人看得出来；
 * 一键清除时也不能连人工的审计进度一起抹掉。形状校验同上：坏条目丢掉，不牵连别的。
 */
export type ManualMark = 'pass' | 'fail'

const MARKS_KEY = 'manim-renderer.marks.v1'

export function loadMarks(): Record<string, ManualMark> {
  try {
    const raw = window.localStorage.getItem(MARKS_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return {}
    const out: Record<string, ManualMark> = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === 'pass' || value === 'fail') out[id] = value
    }
    return out
  } catch (error) {
    console.error('[manim-renderer] 读取人工标注失败:', error)
    return {}
  }
}

export function saveMarks(marks: Record<string, ManualMark>): void {
  try {
    window.localStorage.setItem(MARKS_KEY, JSON.stringify(marks))
  } catch (error) {
    console.error('[manim-renderer] 保存人工标注失败:', error)
  }
}

/** 只清人工标注——自动渲染结果不动。 */
export function clearMarks(): void {
  try {
    window.localStorage.removeItem(MARKS_KEY)
  } catch (error) {
    console.error('[manim-renderer] 清除人工标注失败:', error)
  }
}
