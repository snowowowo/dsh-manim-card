/**
 * 实验场状态落盘：localStorage 是**不可信输入**（用户改得动、旧版本写的也可能对不上）。
 * 这里钉的是「坏数据一律当没存过」——宁可丢一次进度，也不能拿脏数据把页面搞崩。
 * 落盘本身也要能扛住 localStorage 不可用（隐私模式 / 配额满）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearGround, clearMarks, loadExports, loadGround, loadMarks, rememberExport, saveGround, saveMarks } from './storage'

const KEY = 'manim-live.ground.v1'
const MARKS_KEY = 'manim-live.marks.v1'
const EXPORTS_KEY = 'manim-live.exports.v1'

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    // 抛异常的版本：模拟宿主禁用存储
    throwing: false,
  }
}

function useStorage(storage: unknown): void {
  vi.stubGlobal('window', {
    localStorage: new Proxy(storage as object, {
      get(target, prop) {
        const value = Reflect.get(target, prop)
        if (typeof value !== 'function') return value
        return (...args: unknown[]) => {
          if ((storage as { throwing: boolean }).throwing) throw new Error('storage disabled')
          return value.apply(target, args)
        }
      },
    }),
  })
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('loadGround', () => {
  it('没存过给空对象', () => {
    useStorage(fakeStorage())
    expect(loadGround()).toEqual({})
  })

  it('存坏了（非法 JSON / 不是对象）当没存过，并打日志', () => {
    for (const raw of ['{坏', 'null', '42', '"x"']) {
      useStorage(fakeStorage({ [KEY]: raw }))
      expect(loadGround(), `raw=${raw}`).toEqual({})
    }
    expect(console.error).toHaveBeenCalled()
  })

  it('合法形状才收：逐字段校验，别的一律丢', () => {
    useStorage(
      fakeStorage({
        [KEY]: JSON.stringify({
          results: { a: { ok: true, text: '好' }, bad: { ok: 'yes' }, worse: null },
          fast: 'true', // 不是布尔 → 丢
          source: 'print(1)',
          mode: 'nonsense', // 不是两种视图之一 → 丢
        }),
      }),
    )
    expect(loadGround()).toEqual({
      results: { a: { ok: true, text: '好' } },
      source: 'print(1)',
    })
  })

  it('results 类型不对就丢，不影响别的字段', () => {
    for (const results of [42, 'x', null, undefined]) {
      useStorage(fakeStorage({ [KEY]: JSON.stringify({ results, mode: 'free' }) }))
      expect(loadGround(), `results=${String(results)}`).toEqual({ mode: 'free' })
    }
  })

  it('results 歪成数组时只当空表，不牵连别的字段', () => {
    useStorage(fakeStorage({ [KEY]: JSON.stringify({ results: [], mode: 'free' }) }))
    expect(loadGround()).toEqual({ results: {}, mode: 'free' })
  })

  it('存储读不了也不炸（返回空对象）', () => {
    const storage = fakeStorage()
    storage.throwing = true
    useStorage(storage)
    expect(loadGround()).toEqual({})
    expect(console.error).toHaveBeenCalled()
  })
})

describe('saveGround / clearGround', () => {
  it('存下去的是可读回的同一份', () => {
    const storage = fakeStorage()
    useStorage(storage)
    const state = { results: { a: { ok: false, text: '错' } }, fast: true, source: 'x = 1', mode: 'free' as const }
    saveGround(state)
    expect(JSON.parse(storage.map.get(KEY) ?? '')).toEqual(state)
    expect(loadGround()).toEqual(state)
  })

  it('清除就把键拿掉', () => {
    const storage = fakeStorage({ [KEY]: '{}' })
    useStorage(storage)
    clearGround()
    expect(storage.map.has(KEY)).toBe(false)
  })

  it('写 / 清失败也不炸（配额满、被禁用）', () => {
    const storage = fakeStorage()
    storage.throwing = true
    useStorage(storage)
    expect(() => saveGround({ results: {}, fast: false, source: '', mode: 'examples' })).not.toThrow()
    expect(() => clearGround()).not.toThrow()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('人工标注（与自动结果分开存、分开清）', () => {
  it('存下去的对 / 不对能读回同一份', () => {
    const storage = fakeStorage()
    useStorage(storage)
    const marks = { 'basic-circle': 'pass', 'api-rates': 'fail' } as const
    saveMarks(marks)
    expect(loadMarks()).toEqual(marks)
  })

  it('坏形状的条目丢掉、不牵连别的', () => {
    useStorage(fakeStorage({
      [MARKS_KEY]: JSON.stringify({ a: 'pass', b: 'maybe', c: 7, d: null, e: 'fail' }),
    }))
    expect(loadMarks()).toEqual({ a: 'pass', e: 'fail' })
  })

  it('没存过 / 存坏了 / 不是对象 = 空，并打日志', () => {
    for (const raw of [null, '{坏', '42', '"x"']) {
      useStorage(raw === null ? fakeStorage() : fakeStorage({ [MARKS_KEY]: raw }))
      expect(loadMarks(), `raw=${raw as string}`).toEqual({})
    }
    expect(console.error).toHaveBeenCalled()
  })

  it('clearMarks 只动人工标注的键，自动结果那条不动', () => {
    const storage = fakeStorage({ [KEY]: '{"results":{}}', [MARKS_KEY]: '{"a":"pass"}' })
    useStorage(storage)
    clearMarks()
    expect(storage.map.has(MARKS_KEY)).toBe(false)
    expect(storage.map.has(KEY)).toBe(true)
  })
})

/**
 * 导出记录：卡片滚出视口就被卸载，组件状态活不过那一趟——记在 localStorage 里才恢复得回来。
 * 这里钉两件事：坏数据当没存过（同上前两组的口径）、条数有上限（实验场每渲染一次换个 callId，
 * 不限就会一直涨）。
 */
describe('导出记录', () => {
  it('记一条能读回来（同一张卡再导出就覆盖）', () => {
    const storage = fakeStorage()
    useStorage(storage)
    rememberExport('manim-call-1', '/Users/mac/Downloads/a.mp4')
    expect(loadExports()['manim-call-1']?.file).toBe('/Users/mac/Downloads/a.mp4')
    rememberExport('manim-call-1', '/Users/mac/Downloads/b.mp4')
    expect(loadExports()['manim-call-1']?.file).toBe('/Users/mac/Downloads/b.mp4')
  })

  it('坏条目丢掉、不牵连好的（file / at 各校验一遍）', () => {
    useStorage(
      fakeStorage({
        [EXPORTS_KEY]: JSON.stringify({
          good: { file: '/x.mp4', at: 1 },
          noFile: { at: 1 },
          emptyFile: { file: '', at: 1 },
          badAt: { file: '/y.mp4', at: 'now' },
          notObject: 42,
        }),
      }),
    )
    expect(Object.keys(loadExports())).toEqual(['good'])
  })

  it('条数封顶：只留最近的那些（实验场每渲染一次换一个 callId）', () => {
    const storage = fakeStorage()
    useStorage(storage)
    for (let index = 0; index < 60; index += 1) rememberExport(`call-${index}`, `/v/${index}.mp4`)
    const records = loadExports()
    expect(Object.keys(records)).toHaveLength(50)
    // 留下的该是最新的：call-59 在，call-0 已经被裁掉
    expect(records['call-59']).toBeDefined()
    expect(records['call-0']).toBeUndefined()
  })

  it('空 callId / 空路径不记（免得写出一条没用的记录）', () => {
    const storage = fakeStorage()
    useStorage(storage)
    rememberExport('', '/x.mp4')
    rememberExport('call', '')
    expect(loadExports()).toEqual({})
  })

  it('存储不可用时不炸，读回空对象', () => {
    const storage = fakeStorage()
    storage.throwing = true
    useStorage(storage)
    rememberExport('call', '/x.mp4')
    expect(loadExports()).toEqual({})
    expect(console.error).toHaveBeenCalled()
  })
})
