/**
 * 复制：clipboard API 优先，`execCommand` 兜底——宿主 WebView 里两者都可能受限，
 * 而这条兜底是「复制按钮点了没反应」那类 bug 的唯一防线。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './clipboard'

/** 造一个能观察到的 textarea 替身（兜底路径要 append / select / remove）。 */
function fakeArea() {
  return { value: '', style: {} as Record<string, string>, select: vi.fn(), remove: vi.fn() }
}

function stubDom(area: ReturnType<typeof fakeArea>, execCommand: () => boolean) {
  vi.stubGlobal('document', {
    createElement: () => area,
    body: { append: vi.fn() },
    execCommand,
  })
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('copyText', () => {
  it('clipboard API 成功就返回 true，不去碰兜底', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    const area = fakeArea()
    const exec = vi.fn(() => true)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    stubDom(area, exec)

    expect(await copyText('一段代码')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('一段代码')
    expect(exec).not.toHaveBeenCalled()
  })

  it('clipboard API 失败就退到 execCommand，并清掉临时节点', async () => {
    const area = fakeArea()
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('受限')) } })
    stubDom(area, () => true)

    expect(await copyText('x')).toBe(true)
    expect(area.value).toBe('x')
    expect(area.select).toHaveBeenCalled()
    expect(area.remove).toHaveBeenCalled()
  })

  it('兜底也没成功就返回 false，并打日志', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('受限')) } })
    stubDom(fakeArea(), () => false)

    expect(await copyText('x')).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })

  it('连 navigator.clipboard 都没有时也走兜底', async () => {
    vi.stubGlobal('navigator', {})
    stubDom(fakeArea(), () => true)
    expect(await copyText('x')).toBe(true)
  })

  it('全都不行就返回 false（不抛）', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', {
      createElement: () => {
        throw new Error('没有 DOM')
      },
    })
    expect(await copyText('x')).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })
})
