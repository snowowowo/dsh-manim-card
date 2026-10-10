/**
 * 语料取用的客户端逻辑：**空表 = 正式安装**这条判据，以及清缓存的响应处理。
 *
 * 为什么这两条要钉：
 *  - 空表判据错了，正式安装的用户会看到「读取语料失败」而不是「实验场只在开发机可用」——
 *    明明是设计如此，却像坏了；
 *  - 清缓存是唯一会**动用户磁盘**的通道，响应形状再歪也得说清楚删了几个，不能默默返回 undefined。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearPackageCache, corpusStateFrom, loadCorpus } from './corpus'

const example = {
  id: 'a-1',
  group: 'a',
  file: '_dev/examples/a/01.py',
  title: '一条',
  expect: 'ok',
  python: 'pass',
}
const payload = { groups: [{ id: 'a', title: 'A' }], examples: [example] }

/** 假 fetch：语料请求只关心 ok / status / json 三样。 */
const respond = (
  value: unknown,
  init?: { ok?: boolean; status?: number; jsonThrows?: boolean },
): void => {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({
      ok: init?.ok ?? true,
      status: init?.status ?? 200,
      json: () => (init?.jsonThrows === true ? Promise.reject(new Error('bad json')) : Promise.resolve(value)),
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('corpusStateFrom：把响应收成状态', () => {
  it('200 + 有条目 = 可用', () => {
    const state = corpusStateFrom(200, payload)
    expect(state.status).toBe('ready')
    expect(state.status === 'ready' && state.corpus.examples[0]?.id).toBe('a-1')
  })

  it('200 + 空表 = 这台机器没有语料（正式安装），不是错误', () => {
    // 这两条合起来才是「实验场降为开发用」：Host 答了，但那儿没语料
    expect(corpusStateFrom(200, { groups: [], examples: [] }).status).toBe('devOnly')
  })

  it('形状不对也按「没有语料」处理，不炸页面', () => {
    for (const bad of [null, undefined, 42, 'nope', {}, [], { groups: 'x', examples: 'y' }]) {
      expect(corpusStateFrom(200, bad).status, `payload=${JSON.stringify(bad)}`).toBe('devOnly')
    }
  })

  it('条目挂在没登记的分组上就当没有——否则页面上会出现点不开的孤儿', () => {
    const orphan = { ...example, id: 'ghost-1', group: 'ghost' }
    expect(corpusStateFrom(200, { groups: [{ id: 'a', title: 'A' }], examples: [orphan] }).status).toBe('devOnly')
  })

  it('非 2xx 才是错误，并带上状态码', () => {
    expect(corpusStateFrom(500, payload)).toEqual({ status: 'error', message: 'HTTP 500' })
    expect(corpusStateFrom(404, payload)).toEqual({ status: 'error', message: 'HTTP 404' })
  })
})

describe('clearPackageCache：清缓存的响应', () => {
  const stub = (body: unknown, init?: { ok?: boolean; status?: number }) => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: init?.ok ?? true,
        status: init?.status ?? 200,
        json: () => Promise.resolve(body),
      }),
    )
  }

  it('返回被删掉的文件名', async () => {
    stub({ removed: ['a.whl', 'b.whl'] })
    expect(await clearPackageCache()).toEqual(['a.whl', 'b.whl'])
  })

  it('响应里混了非字符串也收得住', async () => {
    stub({ removed: ['a.whl', 7, null, { x: 1 }] })
    expect(await clearPackageCache()).toEqual(['a.whl'])
  })

  it('没有 removed 字段就当没删到东西', async () => {
    stub({})
    expect(await clearPackageCache()).toEqual([])
  })

  it('HTTP 失败要抛，不能报成「清掉了 0 个」', async () => {
    stub({}, { ok: false, status: 500 })
    await expect(clearPackageCache()).rejects.toThrow('HTTP 500')
  })

  it('连不上也要抛', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    await expect(clearPackageCache()).rejects.toThrow('offline')
  })
})

describe('loadCorpus：取数这条 I/O', () => {
  it('拿到条目就是 ready', async () => {
    respond(payload)
    const state = await loadCorpus()
    expect(state.status).toBe('ready')
    expect(state.status === 'ready' && state.corpus.examples[0]?.id).toBe('a-1')
  })

  it('空表就是 devOnly——正式安装的常态，不能报成错误', async () => {
    respond({ groups: [], examples: [] })
    expect(await loadCorpus()).toEqual({ status: 'devOnly' })
  })

  it('连不上 = error，带上原因并打日志', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    expect(await loadCorpus()).toEqual({ status: 'error', message: 'offline' })
    expect(logged).toHaveBeenCalled()
  })

  it('非 2xx = error，带状态码', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    respond(null, { ok: false, status: 503 })
    expect(await loadCorpus()).toEqual({ status: 'error', message: 'HTTP 503' })
    expect(logged).toHaveBeenCalled()
  })

  it('正文不是 JSON = error（页面不能因此崩掉）', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    respond(null, { jsonThrows: true })
    const state = await loadCorpus()
    expect(state).toEqual({ status: 'error', message: 'bad json' })
    expect(logged).toHaveBeenCalled()
  })
})
