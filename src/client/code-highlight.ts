// 只读代码视图的 Python 高亮。
//
// 色板不在这里：shiki 的 css-variables 主题把每个 token 的颜色写成 var(--shiki-token-*)，
// 那批变量由宿主主题表全局定义（浅色 :root、深色 body[data-ds-dark-theme]）——
// 插件沿用宿主这批变量，明暗自动跟随，观感与宿主代码块同一套（AGENTS：色值一律走变量）。
//
// 同步创建、只用 JS 正则引擎（不带 oniguruma WASM）；语法只装 Python 一份——本插件的代码恒为 Manim Python。
import { createHighlighterCoreSync, createCssVariablesTheme } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import langPython from '@shikijs/langs/python'
import type { CSSProperties } from 'react'

/** 一行里的一段着色文本；style 是 shiki 给出的颜色（恒为 var(--shiki-*)）。 */
export interface CodeSpan {
  text: string
  style: CSSProperties
}

/** 逐行高亮结果，行数与源码行数一致。 */
export type CodeLines = CodeSpan[][]

const THEME = createCssVariablesTheme({
  name: 'css-variables',
  variablePrefix: '--shiki-',
  fontStyle: true,
})

type Highlighter = ReturnType<typeof createHighlighterCoreSync>

let highlighter: Highlighter | undefined

function instance(): Highlighter {
  highlighter ??= createHighlighterCoreSync({
    themes: [THEME],
    langs: [langPython],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })
  return highlighter
}

/** vscode-textmate 的字形位（1 斜体、2 粗体）与装饰位（4 下划线、8 删除线）。 */
const DECORATIONS: readonly (readonly [number, string])[] = [[4, 'underline'], [8, 'line-through']]

function spanStyle(color: string | undefined, fontStyle: number): CSSProperties {
  const style: CSSProperties = { color: color ?? 'var(--shiki-foreground)' }
  if ((fontStyle & 1) !== 0) style.fontStyle = 'italic'
  if ((fontStyle & 2) !== 0) style.fontWeight = 'bold'
  const decorations = DECORATIONS.filter(([bit]) => (fontStyle & bit) !== 0)
  if (decorations.length > 0) style.textDecoration = decorations.map(([, value]) => value).join(' ')
  return style
}

/**
 * 高亮一段 Python；`undefined` 表示高亮不可用，调用方退回等宽纯文本。
 * 传入的代码不应带结尾换行（否则 shiki 会多出一空行）。
 */
export function highlightPython(code: string): CodeLines | undefined {
  try {
    const { tokens } = instance().codeToTokens(code, { lang: 'python', theme: 'css-variables' })
    // `a\nb` 得两行、`a\n` 得「一行代码 + 一空行」；丢掉 shiki 为行终止符补的末尾空行。
    const last = tokens[tokens.length - 1]
    const lines = tokens.length > 1 && last !== undefined && last.length === 0
      ? tokens.slice(0, -1)
      : tokens
    return lines.map((line) => line.map((token) => ({
      text: token.content,
      style: spanStyle(token.color, token.fontStyle ?? 0),
    })))
  } catch (error) {
    console.error('[manim-card] python highlight failed:', error)
    return undefined
  }
}
