// 状态点：宿主 `StateDot` 的配方抄一份——宿主 UI 包禁止 import（引了槽位会整体崩）。
// 转圈是那只 1.5 秒一圈的环；空环（`empty`）表示「本机没有 / 还没开始」，与灰色实心的「中性」区分开。
//
// 为什么单独一个文件：设置页的环境行与库行都要它，两处各画一个必然会走样。
import type { StatusTone } from '../runtime-status'

/**
 * @param tone  `ok` 绿 / `warn` 黄 / `error` 红 / `idle` 灰实心 / `empty` 空环 / `busy` 转圈。
 * @param label 给了就是**有语义的状态点**（读屏念得出、鼠标悬浮有原生提示）；不给就当装饰，
 *              因为旁边已经有文字把状态说清了（环境行的版本号、库行那个键、状态条上的状态词）。
 */
export function Dot({ tone, label }: { tone: StatusTone; label?: string }) {
  if (tone === 'busy') {
    return (
      <svg className="mr-set-spin" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <g className="mr-set-spin-rotor">
          <circle className="mr-set-spin-track" cx="12" cy="12" r="9.5" />
          <circle className="mr-set-spin-arc" cx="12" cy="12" r="9.5" />
        </g>
      </svg>
    )
  }
  return (
    <span className="mr-set-dot" data-tone={tone}
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined} />
  )
}
