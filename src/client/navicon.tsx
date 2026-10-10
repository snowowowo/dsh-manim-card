/**
 * 左侧导航图标：只画 currentColor，颜色与选中态由侧栏那一行控制（不在图标里自己上色）；
 * 描边 1.3px 对齐宿主的 Medium 图标。图形 = 坐标轴 + 圆 + 圆上动点。
 */
export function NavIcon({ size }: { size: number; active: boolean }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden
      stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M4 20h16M4 20V4" />
      <circle cx="13" cy="11" r="5" />
      <circle cx="13" cy="6" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
