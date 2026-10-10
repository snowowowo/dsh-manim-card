/**
 * Client 侧 Pyodide 加载器：注入 <script> 再 loadPyodide({ indexURL })。
 *
 * 为什么值得测：这条是「第一次真跑 Python」的必经之路，且**幂等性**很要紧——
 * 重复调用若重置了已缓存的运行时实例，每段代码都会重新拉一遍 13MB 核心。
 * 三种失败（脚本拉不下来 / 脚本在但没暴露 loadPyodide / 重复调用）都在这里钉住。
 *
 * 不需要真 DOM：document 是替身，loadPyodide 也是替身（真加载是几分钟级的集成测试）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../core/py/runtime.ts', () => ({ setPyodideLoader: vi.fn() }))

interface FakeScript {
  src: string
  onload: (() => void) | null
  onerror: (() => void) | null
}

/** 装一个受控的 document.head：append 时按 `outcome` 决定触发 onload 还是 onerror。 */
function stubDom(outcome: 'load' | 'error' | 'silent') {
  const appended: FakeScript[] = []
  vi.stubGlobal('document', {
    createElement: () => ({ src: '', onload: null, onerror: null }) as FakeScript,
    head: {
      append: (script: FakeScript) => {
        appended.push(script)
        if (outcome === 'silent') return
        queueMicrotask(() => (outcome === 'load' ? script.onload?.() : script.onerror?.()))
      },
    },
  })
  return appended
}

/** 每个用例都要一份**全新的模块状态**（installed / scriptPromise 是模块级变量）。 */
async function fresh() {
  vi.resetModules()
  // 顺序 import：并发时两边可能各实例化一份 runtime，拿到的就不是同一个 mock 了
  const runtime = await import('../../core/py/runtime.ts')
  const loader = await import('./pyodide')
  return { install: loader.installPyodideLoader, registered: vi.mocked(runtime.setPyodideLoader) }
}

/** 注册进去的那个加载器（最后一次 setPyodideLoader 的入参）。 */
function lastLoader(registered: ReturnType<typeof vi.fn>): () => Promise<unknown> {
  const call = registered.mock.calls.at(-1)
  if (call === undefined) throw new Error('没有注册加载器')
  return call[0] as () => Promise<unknown>
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('installPyodideLoader', () => {
  it('幂等：重复调用只登记一次（不能重置已缓存的运行时实例）', async () => {
    const { install, registered } = await fresh()
    install()
    install()
    install()
    expect(registered).toHaveBeenCalledTimes(1)
  })

  it('注入 <script> 后 loadPyodide 拿到的 indexURL 是随包路由（末尾带斜杠）', async () => {
    const appended = stubDom('load')
    const loaded: Array<{ indexURL: string }> = []
    vi.stubGlobal('loadPyodide', (options: { indexURL: string }) => {
      loaded.push(options)
      return Promise.resolve({ marker: 'runtime' })
    })
    const { install, registered } = await fresh()
    install()
    await expect(lastLoader(registered)()).resolves.toEqual({ marker: 'runtime' })
    expect(appended).toHaveLength(1)
    expect(appended[0]!.src).toBe('/dsh-plugins/manim-renderer/pyodide/pyodide.js')
    expect(loaded).toEqual([{ indexURL: '/dsh-plugins/manim-renderer/pyodide/' }])
    expect(loaded[0]!.indexURL.endsWith('/')).toBe(true)
  })

  it('脚本只拉一次：连调两次加载器不会插第二个 <script>', async () => {
    const appended = stubDom('load')
    vi.stubGlobal('loadPyodide', () => Promise.resolve({ marker: 'runtime' }))
    const { install, registered } = await fresh()
    install()
    const load = lastLoader(registered)
    await load()
    await load()
    expect(appended).toHaveLength(1)
  })

  it('脚本拉不下来 → 报错里带 src（不然只看到一句没头没尾的失败）', async () => {
    stubDom('error')
    const { install, registered } = await fresh()
    install()
    await expect(lastLoader(registered)()).rejects.toThrow(
      '/dsh-plugins/manim-renderer/pyodide/pyodide.js',
    )
  })

  it('脚本在但没暴露 loadPyodide → 明确报出这一点', async () => {
    stubDom('load')
    const { install, registered } = await fresh()
    install()
    await expect(lastLoader(registered)()).rejects.toThrow('loadPyodide')
  })
})
