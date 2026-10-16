/**
 * 渲染器接线：这是本插件与浏览器侧 Manim 的唯一接口。
 *
 * 要钉住的两件事：
 *  - **两条资源地址来自 `src/routes.js`**，与 Host 注册路由用的是同一个值。写错一边的表现是
 *    「Pyodide 卡在加载」或「公式变豆腐块」，而且只会在真机出现——所以这里的断言对着常量写，
 *    **不抄第二遍字面量**（抄了就失去意义）。
 *  - **全页只有一个渲染器**：核心包的 WASM 运行时与串行执行队列本来就是页面级单例，
 *    多建一个只会多插一份 KaTeX `<link>`、多记一份账，没有半点好处。
 *
 * `manim-live` 整块被替身接走：本文件测的是「接线」，不是渲染；真运行时的行为在核心包自己的
 * 套件里（pyodide / runtime / bridge / headless）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('manim-live', () => ({
  createManimRenderer: vi.fn(),
}))

import { createManimRenderer, type ManimRenderer, type Surface } from 'manim-live'
import { KATEX_ROUTE, PYODIDE_ROUTE } from '../routes.js'
import { disposeManimRenderer, manimRenderer } from './renderer'

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
  it('把两条资源地址作为配置交给核心包（真源是 src/routes.js，与 Host 注册的是同一个值）', () => {
    manimRenderer()
    expect(createManimRenderer).toHaveBeenCalledWith({
      pyodideIndexURL: PYODIDE_ROUTE,
      katexBaseURL: KATEX_ROUTE,
    })
  })

  it('全页只建一个渲染器（核心的 WASM 与串行队列本就是页面级单例）', () => {
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
