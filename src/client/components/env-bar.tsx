// 环境状态条：实验场顶栏下面一条，四枚 chip —— 本机 Manim（导出走它）/ 运行时 / 公式样式 / 浏览器能力。
//
// 为什么要有它：这台机器上「能不能出画面、能不能导出 mp4」由四组条件决定，而在它之前
// 这些条件**只有出错时才现身**（渲染抛错、导出按钮灰着），用户看不到全景、也不知道能做什么。
// 四枚 chip 是常驻的读数，出问题的那一枚才可点——点开是待处理项与能立刻做的动作（预热 / 重新检测）。
//
// 数据全从 ./runtime-status 来（浏览器侧订阅核心包，本机侧问 Host）。这一层只管摆位置与点击。
import { useState } from 'react'
import { Dot } from './dot'
import { warmupManim } from '../service'
import { chipsOf, pendingHints, useEnvironmentStatus, useLocalEnv, type ChipId } from '../runtime-status'
import type { Translate } from '../i18n'

export function EnvBar({ t }: { t: Translate }) {
  const status = useEnvironmentStatus()
  const local = useLocalEnv()
  /** 展开的是哪一枚（null = 收起）。四枚共用一个面板，因为面板说的是同一件事：这台机器还缺什么。 */
  const [open, setOpen] = useState<ChipId | null>(null)
  const [warming, setWarming] = useState(false)
  /** 预热回执（null = 还没按过）。成功也要说一声：预热没有画面回执，不说就不知道按了有没有用。 */
  const [warmNote, setWarmNote] = useState<string | null>(null)

  const chips = chipsOf({ t, status, local: local.state })
  const pending = pendingHints({ t, status, local: local.state })
  // 没加载过才谈得上预热；已经在加载 / 已就绪时这个键没有意义，不给。
  const canWarm = status.runtime.phase === 'idle' || status.runtime.phase === 'error'
  const localBroken = local.state.phase === 'missing' || local.state.phase === 'unknown'

  const warm = async (): Promise<void> => {
    if (warming) return
    setWarming(true)
    setWarmNote(null)
    try {
      await warmupManim()
      setWarmNote(t('envbarWarmed'))
    } catch (error) {
      console.error('[manim-live] 预热失败:', error)
      setWarmNote(t('envbarWarmFailed', { message: error instanceof Error ? error.message : String(error) }))
    } finally {
      setWarming(false)
    }
  }

  return (
    <div className="mr-envbar-wrap">
      <div className="mr-envbar" role="group" aria-label={t('envbarLabel')}>
        {chips.map((chip) => {
          const body = (
            <>
              <Dot tone={chip.tone} />
              <span className="mr-chip-name">{chip.label}</span>
              <span className="mr-chip-value">{chip.value}</span>
            </>
          )
          // 满足的 chip 是纯标签（点它没有可做的事）；不满足的才是按钮，点了展开待处理项。
          return chip.actionable ? (
            <button
              key={chip.id}
              className="mr-chip"
              type="button"
              data-tone={chip.tone}
              aria-expanded={open === chip.id}
              title={chip.detail}
              onClick={() => setOpen((current) => (current === chip.id ? null : chip.id))}
            >
              {body}
            </button>
          ) : (
            <span key={chip.id} className="mr-chip" data-tone={chip.tone} title={chip.detail}>{body}</span>
          )
        })}
        {warmNote !== null && <span className="mr-envbar-note" role="status">{warmNote}</span>}
      </div>
      {open !== null && (
        <div className="mr-envpanel">
          {pending.length === 0
            ? <p className="mr-envpanel-empty">{t('chipUnknown')}</p>
            : (
              <ul className="mr-envpanel-list">
                {pending.map((line) => <li key={line}>{line}</li>)}
              </ul>
            )}
          <div className="mr-envpanel-acts">
            {canWarm && (
              <button className="mr-btn outline" type="button" disabled={warming} onClick={() => void warm()}>
                {warming ? t('envbarWarming') : t('envbarWarmup')}
              </button>
            )}
            {localBroken && (
              <button className="mr-btn outline" type="button" onClick={local.refresh}>{t('envbarReprobe')}</button>
            )}
            <button className="mr-btn outline" type="button" onClick={() => setOpen(null)}>{t('envbarClose')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
