/**
 * 本文件的落盘职责：**导出记录**。localStorage 是**不可信输入**（用户改得动、旧版本写的
 * 也可能对不上），所以读的时候逐字段校验，坏数据一律当没存过——宁可丢一条记录，也不能
 * 拿脏数据把页面搞崩。
 */

/**
 * 导出记录：一张卡导出成功后，把落盘的路径记下来。
 *
 * 为什么非存不可：卡片的状态是组件里的 `useState`，而聊天流滚出视口就**卸载**卡片
 * （见 card.tsx 顶注），滚回来是全新挂载——刚导出的路径、那条绿勾回执会一起没掉。
 * 存下来之后，「导出过什么、在哪儿」跟着卡片身份（`callId`）走，重挂也能恢复。
 *
 * 为什么要限条数：不限就会一直涨。保留最近 N 条——用户真正要找的是「刚刚那份」，
 * 越老的越没用。
 */
export interface ExportRecord {
  file: string
  at: number
}

const EXPORTS_KEY = 'manim-card.exports.v1'
/** 记录条数上限：够回过头找最近导出的一批，又不会越长越肥。 */
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
    console.error('[manim-card] 读取导出记录失败:', error)
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
    console.error('[manim-card] 保存导出记录失败:', error)
  }
}
