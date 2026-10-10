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

/**
 * 导出记录：一张卡导出成功后，把落盘的路径记下来。
 *
 * 为什么非存不可：卡片的状态是组件里的 `useState`，而聊天流滚出视口就**卸载**卡片
 * （见 card.tsx 顶注），滚回来是全新挂载——刚导出的路径、那条绿勾回执会一起没掉。
 * 存下来之后，「导出过什么、在哪儿」跟着卡片身份（`callId`）走，重挂也能恢复。
 *
 * 为什么要限条数：实验场每渲染一次就换一个 `callId`（`free-1`、`free-2`…），不限就会一直涨。
 * 保留最近 N 条——用户真正要找的是「刚刚那份」，越老的越没用。
 */
export interface ExportRecord {
  file: string
  at: number
}

const EXPORTS_KEY = 'manim-renderer.exports.v1'
/** 记录条数上限：够回过头找最近导出的一批，又不会在实验场里越长越肥。 */
const EXPORTS_LIMIT = 50

export function loadExports(): Record<string, ExportRecord> {
  try {
    const raw = window.localStorage.getItem(EXPORTS_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return {}
    const out: Record<string, ExportRecord> = {}
    for (const [callId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === null || typeof value !== 'object') continue
      const bag = value as Record<string, unknown>
      // 坏条目丢掉、不牵连别的（localStorage 是不可信输入）
      if (typeof bag.file !== 'string' || bag.file.length === 0) continue
      if (typeof bag.at !== 'number' || !Number.isFinite(bag.at)) continue
      out[callId] = { file: bag.file, at: bag.at }
    }
    return out
  } catch (error) {
    console.error('[manim-renderer] 读取导出记录失败:', error)
    return {}
  }
}

/**
 * 记一条导出（同一张卡再导出就覆盖），并按时间裁到上限。
 *
 * 时间戳**单调递增**：同一毫秒里连写多条时，`Date.now()` 会给出相同的值，
 * 「保留最近 50 条」就变成了一道没有正确答案的题（实测：连写 60 条的测试因此间歇性变红，
 * 而且剪枝后存回去的顺序是「新→旧」，靠插入下标兜底会越兜越错）。所以新记录取
 * `max(现在, 已存的最大值 + 1)`——真实场景里每条本来就隔着好几秒，这么写不影响任何行为，
 * 却让「谁更新」在任何时候都有确定答案。
 */
export function rememberExport(callId: string, file: string): void {
  if (callId.length === 0 || file.length === 0) return
  try {
    const records = loadExports()
    const newest = Object.values(records).reduce((max, record) => Math.max(max, record.at), 0)
    records[callId] = { file, at: Math.max(Date.now(), newest + 1) }
    const kept = Object.entries(records)
      .sort((left, right) => right[1].at - left[1].at)
      .slice(0, EXPORTS_LIMIT)
    window.localStorage.setItem(EXPORTS_KEY, JSON.stringify(Object.fromEntries(kept)))
  } catch (error) {
    console.error('[manim-renderer] 保存导出记录失败:', error)
  }
}
