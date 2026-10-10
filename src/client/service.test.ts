/**
 * 对外服务 `manim`，以及它背后的渲染器接线。
 *
 * 为什么值得测：这是插件之间**唯一**的协作面。契约里最关键的一条是「检查失败回 ok:false，
 * 不抛」——抛出去就是把调用方一起带崩，等于服务缺席时反而更糟。
 *
 * 抽包（Phase 1）之后本文件多了第二件要钉住的事：**两条资源地址来自 `src/routes.js`**，
 * 与 Host 注册路由用的是同一个值。写错一边的表现是「Pyodide 卡在加载」或「公式变豆腐块」，
 * 而且只会在真机出现——所以这里的断言对着常量写，**不抄第二遍字面量**（抄了就失去意义）。
 *
 * `manim-live` 整块被替身接走：本文件测的是「接线」，不是渲染；真运行时的行为在核心包自己的
 * 套件里（pyodide / runtime / bridge / headless）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('manim-live', () => ({ createManimRenderer: vi.fn() }))

import { createManimRenderer, type ManimRenderer, type Surface } from 'manim-live'
import { KATEX_ROUTE, PYODIDE_ROUTE } from '../routes.js'
import { createManimService, disposeManimRenderer, manimRenderer } from './service'

/** 假渲染器：只记调用，不起 Pyodide / WebGL。 */
function stubRenderer(): ManimRenderer {
  return {
    warmup: () => Promise.resolve(),
    check: vi.fn(() => Promise.resolve({ ok: true })),
    createSurface: vi.fn(() => Promise.resolve({ dispose: () => {} } as unknown as Surface)),
    exporters: [],
    pyodideIndexURL: () => PYODIDE_ROUTE,
    dispose: vi.fn(),
  }
}

let renderer: ManimRenderer

beforeEach(() => {
  // 单例是模块级的，上一条用例留下的必须清掉，否则后一条拿到的是别人的替身
  disposeManimRenderer()
  vi.mocked(createManimRenderer).mockReset()
  renderer = stubRenderer()
  vi.mocked(createManimRenderer).mockReturnValue(renderer)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('渲染器接线', () => {
  it('把两条 DSH 资源地址作为配置交给核心包（真源是 src/routes.js，与 Host 注册的是同一个值）', () => {
    manimRenderer()
    expect(createManimRenderer).toHaveBeenCalledWith({
      pyodideIndexURL: PYODIDE_ROUTE,
      katexBaseURL: KATEX_ROUTE,
    })
  })

  it('全页只建一个渲染器——卡片与对外服务共用同一份（核心的 WASM 与串行队列本就是页面级单例）', () => {
    expect(manimRenderer()).toBe(manimRenderer())
    expect(createManimRenderer).toHaveBeenCalledTimes(1)
  })

  it('懒建：只 import 本模块时不碰核心工厂（不注入样式、不登记加载器）', () => {
    expect(createManimRenderer).not.toHaveBeenCalled()
  })

  it('dispose 真释放，之后再取会**重建**一个（卸载不留悬空引用）', () => {
    const first = manimRenderer()
    expect(createManimRenderer).toHaveBeenCalledTimes(1)
    disposeManimRenderer()
    expect(first.dispose).toHaveBeenCalledTimes(1)
    // 替身工厂永远回同一个对象，所以这里断言的是「又建了一次」，不是「不是原来那个」
    expect(manimRenderer()).toBeDefined()
    expect(createManimRenderer).toHaveBeenCalledTimes(2)
  })

  it('没建过就 dispose 不炸（卸载路径不能因为顺序问题抛）', () => {
    expect(() => disposeManimRenderer()).not.toThrow()
  })
})

describe('check：干跑预检原样转发', () => {
  it('通过时回 ok:true，并把源码原样交给渲染器', async () => {
    vi.mocked(renderer.check).mockResolvedValue({ ok: true })
    await expect(createManimService().check('from manim import *')).resolves.toEqual({ ok: true })
    expect(renderer.check).toHaveBeenCalledWith('from manim import *')
  })

  it('失败时回 ok:false 与错误，不抛（核心包负责收住，这一层不许再加戏）', async () => {
    vi.mocked(renderer.check).mockResolvedValue({ ok: false, error: '第 3 行：NameError' })
    await expect(createManimService().check('bad')).resolves.toEqual({
      ok: false,
      error: '第 3 行：NameError',
    })
  })
})

describe('createSurface：就一件事——转交给渲染器', () => {
  it('容器原样传下去，返回渲染器的结果', async () => {
    const surface = { dispose: () => {} } as unknown as Surface
    vi.mocked(renderer.createSurface).mockResolvedValue(surface)
    const container = { tagName: 'DIV' } as unknown as HTMLDivElement
    await expect(createManimService().createSurface(container)).resolves.toBe(surface)
    expect(renderer.createSurface).toHaveBeenCalledWith(container)
  })

  it('服务与卡片拿到的是同一个渲染器（不是各建一份）', async () => {
    await createManimService().createSurface({ tagName: 'DIV' } as unknown as HTMLDivElement)
    expect(renderer.createSurface).toHaveBeenCalledTimes(1)
    expect(createManimRenderer).toHaveBeenCalledTimes(1)
  })
})
