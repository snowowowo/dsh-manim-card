// 分段控件（视图切换）：照抄宿主 `ui-primitives/SegmentedControl`——等宽 grid 轨道 +
// 一个滑动的指示块，选中态与漫游键位都按宿主那套行为来（←→↑↓ 走位、Home/End 跳首尾）。
//
// 宿主包不能 import，所以 markup 与样式各抄一份，类名换成 mr- 前缀（见 styles.css 的 .mr-seg-*）。
import type { CSSProperties, KeyboardEvent } from 'react'

export interface SegmentedOption<Value extends string> {
  value: Value
  label: string
  disabled?: boolean
}

type WalkKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'

const isWalkKey = (key: string): key is WalkKey =>
  key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown'
  || key === 'Home' || key === 'End'

/** 漫游键落到的下一个可选项：方向键走最近的一个（可绕回），Home/End 跳首尾。 */
function walk<Value extends string>(
  options: readonly SegmentedOption<Value>[],
  from: number,
  key: WalkKey,
): SegmentedOption<Value> | undefined {
  const enabled = options.filter((option) => option.disabled !== true)
  if (key === 'Home') return enabled[0]
  if (key === 'End') return enabled[enabled.length - 1]
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1
  const count = options.length
  for (let offset = 1; offset < count; offset += 1) {
    const candidate = options[(((from + step * offset) % count) + count) % count]
    if (candidate !== undefined && candidate.disabled !== true) return candidate
  }
  return undefined
}

export function Segmented<Value extends string>({ value, options, onChange, label, disabled = false }: {
  value: Value
  options: readonly SegmentedOption<Value>[]
  onChange: (next: Value) => void
  label: string
  disabled?: boolean
}) {
  const selected = options.findIndex((option) => option.value === value)

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!isWalkKey(event.key)) return
    event.preventDefault()
    const target = walk(options, selected, event.key)
    if (target !== undefined && target.value !== value) onChange(target.value)
  }

  // 指示块的位置与宽度由「第几个 / 共几个」算出来，不去量 DOM（宿主原样）。
  const geometry = {
    '--mr-seg-count': String(options.length),
    '--mr-seg-index': String(Math.max(selected, 0)),
  } as CSSProperties

  return (
    <div role="tablist" aria-label={label} className="mr-seg" style={geometry}>
      <span aria-hidden="true" className="mr-seg-indicator" />
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled || option.disabled === true}
            className="mr-seg-tab"
            onClick={() => { if (!active) onChange(option.value) }}
            onKeyDown={onKeyDown}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
