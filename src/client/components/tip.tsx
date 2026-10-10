// 悬浮提示：把「说明文案」从页面上平铺改成悬停/键盘聚焦才出现，页面只留控件本身。
//
// 为什么不 import 宿主那个 Tooltip：宿主 UI 包（ui-primitives）禁止 import（设计系统硬规则，
// 引了槽位会整体崩）。所以照它的气泡配方抄一份——`tooltip-bg` 底 + 13px/20px + 0.5px 圆角系。
import type { ReactNode } from 'react'

/**
 * 包住一个控件、给它一段悬浮说明。
 * @param align 气泡的水平对齐：`center` 居中于控件；`start` 贴控件左缘、`end` 贴控件右缘
 *   （贴边的按钮用，免得气泡出界）。
 * @param wide 成段的长说明用：气泡放宽到 440px（默认 300px 是给一句话的）。
 * @param className 加在气泡那一层上的额外类名。用在**外层要参与布局**的地方——
 *   比如「占满剩余宽度」的那条（`.mr-chatcard-pathwrap`）；不传就只吃 `.mr-tip` 自己的样式。
 */
export function Tip({ label, children, align = 'center', wide = false, className }: {
  label: string
  children: ReactNode
  align?: 'center' | 'start' | 'end'
  wide?: boolean
  className?: string
}) {
  return (
    <span className={className === undefined ? 'mr-tip' : `mr-tip ${className}`} data-align={align}>
      {children}
      <span className={wide ? 'mr-tip-bubble is-wide' : 'mr-tip-bubble'} role="tooltip">{label}</span>
    </span>
  )
}
