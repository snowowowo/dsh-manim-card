/**
 * 对外服务 `manim`：别的插件（将来的黑板）经 `ctx.get('manim')` 拿到的两件事——干跑预检 + 造画布。
 *
 * 为什么值得测：这是插件之间**唯一**的协作面。契约里最关键的一条是「检查失败回 ok:false，
 * 不抛」——抛出去就是把调用方一起带崩，等于服务缺席时反而更糟。依赖（Python 运行时 /
 * Pyodide 加载器 / 画布工厂）在这里全被替身接走，不真起 Pyodide。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../core/py/runtime.ts', () => ({ runPython: vi.fn() }))
vi.mock('./engine/pyodide', () => ({ installPyodideLoader: vi.fn() }))
vi.mock('./engine/renderer', () => ({ createSurface: vi.fn() }))

import { runPython } from '../core/py/runtime.ts'
import { installPyodideLoader } from './engine/pyodide'
import { createSurface } from './engine/renderer'
import { createManimService } from './service'

beforeEach(() => {
  vi.mocked(runPython).mockReset()
  vi.mocked(installPyodideLoader).mockReset()
  vi.mocked(createSurface).mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('check：干跑预检', () => {
  it('通过时回 ok:true，并确保加载器已装上（check 可能先于任何画布被调用）', async () => {
    vi.mocked(runPython).mockResolvedValue(undefined)
    await expect(createManimService().check('from manim import *')).resolves.toEqual({ ok: true })
    expect(installPyodideLoader).toHaveBeenCalled()
  })

  it('失败时回 ok:false 与错误，不抛（抛出去会把调用方一起带崩）', async () => {
    vi.mocked(runPython).mockRejectedValue(new Error('第 3 行：NameError'))
    await expect(createManimService().check('bad')).resolves.toEqual({
      ok: false,
      error: '第 3 行：NameError',
    })
    expect(console.error).toHaveBeenCalled()
  })

  it('抛的不是 Error 也收得住', async () => {
    vi.mocked(runPython).mockRejectedValue('weird')
    await expect(createManimService().check('bad')).resolves.toEqual({ ok: false, error: 'weird' })
  })
})

describe('createSurface：就一件事——转交给画布工厂', () => {
  it('容器原样传下去，返回工厂的结果', async () => {
    const surface = { dispose: () => {} }
    vi.mocked(createSurface).mockResolvedValue(surface as never)
    const container = { tagName: 'DIV' } as unknown as HTMLDivElement
    await expect(createManimService().createSurface(container)).resolves.toBe(surface)
    expect(createSurface).toHaveBeenCalledWith(container)
  })
})
