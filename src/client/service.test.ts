/**
 * 对外服务 `manim-card`，以及它背后的渲染器接线。
 *
 * 为什么值得测：这是插件之间**唯一**的协作面。契约里最关键的一条是「检查失败回 ok:false，
 * 不抛」——抛出去就是把调用方一起带崩，等于服务缺席时反而更糟。
 *
 * 抽包（Phase 1）之后本文件多了第二件要钉住的事：**两条资源地址来自 `src/routes.js`**，
 * 与 Host 注册路由用的是同一个值。写错一边的表现是「Pyodide 卡在加载」或「公式变豆腐块」，
 * 而且只会在真机出现——所以这里的断言对着常量写，**不抄第二遍字面量**（抄了就失去意义）。
 *
 * 第三件是环境状态那两个成员：它们是转发而不是重算，**必须是核心包模块级函数本身**。
 * 这一层若自己造一份状态（或让调用方去 import 第二份核心包），读数会与真实运行时脱节，
 * 而症状是「黑板永远显示未加载」这种不报错、只显示错的形态——所以在这里钉死「同一份」。
 *
 * `manim-live` 整块被替身接走：本文件测的是「接线」，不是渲染；真运行时的行为在核心包自己的
 * 套件里（pyodide / runtime / bridge / headless）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('manim-live', () => ({
  createManimRenderer: vi.fn(),
  environmentStatus: vi.fn(),
  onEnvironmentStatus: vi.fn(),
}))

import {
  createManimRenderer,
  environmentStatus,
  onEnvironmentStatus,
  type EnvironmentStatus,
  type ManimRenderer,
  type Surface,
} from 'manim-live'
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

/** 一份最小可用快照（形状照 `EnvironmentStatus` 写，字段含义不在这里测）。 */
function stubStatus(): EnvironmentStatus {
  return {
    capabilities: { wasm: true, webgl: true, videoExport: true },
    runtime: { phase: 'idle', indexURL: PYODIDE_ROUTE },
    katex: { baseURL: KATEX_ROUTE, phase: 'loaded' },
    packages: { fetching: [] },
    hints: [],
  }
}

beforeEach(() => {
  // 单例是模块级的，上一条用例留下的必须清掉，否则后一条拿到的是别人的替身
  disposeManimRenderer()
  vi.mocked(createManimRenderer).mockReset()
  renderer = stubRenderer()
  vi.mocked(createManimRenderer).mockReturnValue(renderer)
  vi.mocked(environmentStatus).mockReset()
  vi.mocked(environmentStatus).mockReturnValue(stubStatus())
  vi.mocked(onEnvironmentStatus).mockReset()
  vi.mocked(onEnvironmentStatus).mockReturnValue(() => {})
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

describe('环境状态：转发核心包的模块级函数，不经渲染器实例', () => {
  it('快照原样回传——调用方拿到的是本插件这一份的读数，不是自己 import 的第二份', () => {
    const status = stubStatus()
    vi.mocked(environmentStatus).mockReturnValue(status)
    expect(createManimService().environmentStatus()).toBe(status)
    expect(environmentStatus).toHaveBeenCalledTimes(1)
  })

  it('订阅把回调原样交给核心，退订函数原样回传（退订这条不能在本层被吞掉）', () => {
    const unsubscribe = vi.fn()
    vi.mocked(onEnvironmentStatus).mockReturnValue(unsubscribe)
    const cb = vi.fn()

    const service = createManimService()
    expect(service.onEnvironmentStatus(cb)).toBe(unsubscribe)
    expect(onEnvironmentStatus).toHaveBeenCalledWith(cb)
    // 服务这层只是转发：退订真身由核心包持有，本层不许自己再包一层或换一个函数
    service.onEnvironmentStatus(cb)()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('读状态与建渲染器是两件独立的事——不建渲染器也读得到（服务还是把渲染器一起建起来，那是有意的）', () => {
    createManimService().environmentStatus()
    expect(environmentStatus).toHaveBeenCalledTimes(1)
    // 渲染器这两个成员一个都不该碰：状态不属于某块画布
    expect(renderer.createSurface).not.toHaveBeenCalled()
    expect(renderer.check).not.toHaveBeenCalled()
  })
})
