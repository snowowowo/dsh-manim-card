/**
 * 高亮契约测试：颜色必须走宿主 token 变量，行结构必须与源码一致。
 * 不断言具体色值（那是宿主 shiki.css 的事），也不碰 DOM——只锁这两条会静默漂掉的约定。
 */
import { describe, expect, it } from 'vitest'
import { highlightPython } from './code-highlight.ts'

const source = 'circle = Circle(radius=1)\n\nself.play(Create(circle))'

describe('highlightPython', () => {
  it('逐行对应源码，且保留空行', () => {
    const lines = highlightPython(source)
    expect(lines).toBeDefined()
    expect(lines?.length).toBe(3)
    expect(lines?.[1]).toEqual([])
  })

  it('不丢字符：每行 span 文本拼回原文', () => {
    const lines = highlightPython(source)
    const rebuilt = lines?.map((line) => line.map((span) => span.text).join('')).join('\n')
    expect(rebuilt).toBe(source)
  })

  it('颜色走宿主 token 变量，不写死色值', () => {
    const lines = highlightPython('from manim import *')
    const colors = lines?.flat().map((span) => span.style.color) ?? []
    expect(colors.length).toBeGreaterThan(0)
    for (const color of colors) expect(color).toMatch(/^var\(--shiki-/)
  })
})
