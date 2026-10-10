// 剪贴板：clipboard API 优先，execCommand 兜底——宿主 WebView 里两者都可能受限。
// 组件侧要的「复制成功给个 1.2s 反馈」一并放这里，省得每个复制按钮各写一遍计时器。
import { useEffect, useRef, useState } from 'react'

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.append(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      if (!ok) console.error('[manim-live] execCommand 复制失败:', error)
      return ok
    } catch (fallbackError) {
      console.error('[manim-live] copy failed:', fallbackError)
      return false
    }
  }
}

/** 复制并给出 1.2 秒的「已复制」反馈：返回 [是否刚复制, 触发复制]。 */
export function useCopied(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  const copy = (text: string): void => {
    void copyText(text).then((ok) => {
      if (!ok) return
      setCopied(true)
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1200)
    })
  }

  return [copied, copy]
}
