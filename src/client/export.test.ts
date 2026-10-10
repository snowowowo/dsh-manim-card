/**
 * 导出取数的形状校验：这些响应都来自 Host，但**不可信**的程度不比 localStorage 低——
 * 版本对不上（插件包与 Host 半边的更新不同步）、中间层塞了错误页，任何一段都可能变样。
 * 这里钉住「形状不对时怎么办」：读不通的都往**保守那一侧**倒（就绪 = 不可用、
 * 定位 = 失败），宁可按钮灰着、宁可说打不开，也不放行一个说不清的动作。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseReadiness, parseReveal } from './export'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseReadiness', () => {
  it('正常形状：ready 与缺什么', () => {
    expect(parseReadiness({ ready: false, missing: [{ id: 'ffmpeg', detail: 'PATH 里找不到 ffmpeg' }] })).toEqual({
      ready: false,
      missing: [{ id: 'ffmpeg', detail: 'PATH 里找不到 ffmpeg' }],
    })
  })

  it('ready 不是布尔就当形状不对（回 null，调用方按「不可用」处理）', () => {
    for (const payload of [null, 'x', 42, {}, { ready: 'yes' }, { missing: [] }]) {
      expect(parseReadiness(payload), JSON.stringify(payload)).toBeNull()
    }
  })

  it('missing 里的坏条目丢掉、不牵连好的', () => {
    expect(
      parseReadiness({
        ready: false,
        missing: [{ id: 'latex', detail: '没装' }, { detail: '少了 id' }, null, 42],
      }),
    ).toEqual({ ready: false, missing: [{ id: 'latex', detail: '没装' }] })
  })

  it('missing 缺省时给空表（ready=true 那一路就是不带 missing 的）', () => {
    expect(parseReadiness({ ready: true })).toEqual({ ready: true, missing: [] })
  })
})

describe('parseReveal', () => {
  it('成功与三类失败都认得', () => {
    expect(parseReveal({ ok: true })).toMatchObject({ ok: true, code: '' })
    for (const code of ['missing', 'outside', 'failed']) {
      expect(parseReveal({ ok: false, code, error: '原因' })).toEqual({ ok: false, code, error: '原因' })
    }
  })

  it('形状不对按「命令跑失败」处理，不谎称文件还在', () => {
    for (const payload of [null, 'x', 42, {}, { ok: 'yes' }]) {
      expect(parseReveal(payload), JSON.stringify(payload)).toMatchObject({ ok: false, code: 'failed' })
    }
  })

  it('失败但认不出原因：归到 failed（页面只说「打不开」，不去猜是哪种打不开）', () => {
    expect(parseReveal({ ok: false, code: 'wat', error: 'x' })).toEqual({ ok: false, code: 'failed', error: 'x' })
    expect(parseReveal({ ok: false, error: 'x' })).toEqual({ ok: false, code: 'failed', error: 'x' })
  })
})
