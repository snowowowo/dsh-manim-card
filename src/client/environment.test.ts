/**
 * 本机环境探测的取数与解析。为什么值得单独测：
 *  - 这条响应**是不可信输入**（Host 随插件换版而变），而界面按 `status` 决定画绿点还是红点——
 *    `ok` / `missing` / `error` 三个值之外的任何东西都必须被挡在外面，不能让它漏进渲染；
 *  - `probeEnv` 抛错是**逐行独立**的机制：一项失败要把这一行标成出错、别的行照跑，
 *    所以「HTTP 失败要抛」这条不能变成「回一个 status:error 的结果」（那会让界面分不清
 *    「这项没装」和「这条路由挂了」）。
 * 网络一律打桩。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadEnvPlan, parsePlan, parseResult, probeEnv } from './environment'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const respond = (body: unknown, init?: { ok?: boolean; status?: number }): ReturnType<typeof vi.fn> => {
  const spy = vi.fn(() =>
    Promise.resolve({ ok: init?.ok ?? true, status: init?.status ?? 200, json: () => Promise.resolve(body) }),
  )
  vi.stubGlobal('fetch', spy)
  return spy
}

describe('parsePlan（外部输入）', () => {
  const check = { id: 'manim', tool: 'manim', command: 'manim --version' }

  it('正常计划原样收下', () => {
    const plan = parsePlan({ platform: 'darwin', arch: 'arm64', node: 'v22', path: '/usr/bin', checks: [check] })
    expect(plan?.checks).toEqual([check])
    expect(plan?.node).toBe('v22')
  })

  it('缺字段的那一条只丢那一条，不整份作废', () => {
    const plan = parsePlan({ checks: [check, { tool: 'ffmpeg' }, null, 'nonsense', { id: 'ffmpeg' }] })
    expect(plan?.checks.map((item) => item.id)).toEqual(['manim', 'ffmpeg'])
  })

  it('一条都不剩（或没有该项）就算形状不对——空计划会让页面显示一个永远转圈的环境区', () => {
    expect(parsePlan({})).toBeNull()
    expect(parsePlan({ checks: [] })).toBeNull()
    expect(parsePlan({ checks: [null, { tool: 'x' }] })).toBeNull()
    for (const bad of [null, undefined, 42, 'nope', []]) {
      expect(parsePlan(bad), `payload=${JSON.stringify(bad)}`).toBeNull()
    }
  })

  it('元信息字段不是字符串就当空串，不把 undefined 塞给界面', () => {
    const plan = parsePlan({ checks: [check], platform: 7, node: null })
    expect(plan?.platform).toBe('')
    expect(plan?.node).toBe('')
  })
})

describe('parseResult（外部输入）', () => {
  it('三态各自收下', () => {
    for (const status of ['ok', 'missing', 'error'] as const) {
      expect(parseResult({ id: 'manim', status, path: null, version: '', detail: '' })?.status).toBe(status)
    }
  })

  it('三态之外一律回 null——界面按它选颜色，多一个值就是一条渲染不出来的行', () => {
    expect(parseResult({ id: 'manim', status: 'weird' })).toBeNull()
    expect(parseResult({ id: 'manim' })).toBeNull()
    expect(parseResult({ id: 'manim', status: 'OK' })).toBeNull()
  })

  it('没有 id 就认不出是哪一项，回 null', () => {
    expect(parseResult({ status: 'ok' })).toBeNull()
    expect(parseResult({ id: '', status: 'ok' })).toBeNull()
  })

  it('path 只在真的是字符串时给出，否则 null（找不到命令时 Host 回的就是 null）', () => {
    expect(parseResult({ id: 'm', status: 'missing', path: null })?.path).toBeNull()
    expect(parseResult({ id: 'm', status: 'ok', path: 7 })?.path).toBeNull()
    expect(parseResult({ id: 'm', status: 'ok', path: '/usr/bin/manim' })?.path).toBe('/usr/bin/manim')
  })

  it('形状不对回 null（连数组 / 字符串都挡掉）', () => {
    for (const bad of [null, undefined, 42, 'nope', []]) {
      expect(parseResult(bad), `payload=${JSON.stringify(bad)}`).toBeNull()
    }
  })
})

describe('loadEnvPlan：取计划这条 I/O', () => {
  it('就是 GET 一次那条路由', async () => {
    const spy = respond({ checks: [{ id: 'manim' }] })
    await loadEnvPlan()
    expect(spy.mock.calls[0]![0]).toBe('/dsh-plugins/manim-renderer/environment')
  })

  it('拿到计划就是计划', async () => {
    respond({ platform: 'darwin', checks: [{ id: 'manim', tool: 'manim', command: 'manim --version' }] })
    expect((await loadEnvPlan()).platform).toBe('darwin')
  })

  it('非 2xx 抛，带状态码', async () => {
    respond(null, { ok: false, status: 503 })
    await expect(loadEnvPlan()).rejects.toThrow('HTTP 503')
  })

  it('形状不对要抛，不能拿半个计划去渲染', async () => {
    respond({ checks: 'nope' })
    await expect(loadEnvPlan()).rejects.toThrow('形状不对')
  })
})

describe('probeEnv：一项一项问', () => {
  it('按 id 拼 URL 并转义（id 是外来的，不能直接拼进路径）', async () => {
    const spy = respond({ id: 'a b', status: 'ok' })
    await probeEnv('a b')
    expect(spy.mock.calls[0]![0]).toBe('/dsh-plugins/manim-renderer/environment/a%20b')
  })

  it('ok 带版本行', async () => {
    respond({ id: 'python3', status: 'ok', path: '/usr/bin/python3', version: 'Python 3.13.12', detail: '' })
    expect(await probeEnv('python3')).toEqual({
      id: 'python3', status: 'ok', path: '/usr/bin/python3', version: 'Python 3.13.12', detail: '',
    })
  })

  it('missing 带原因（「装了却说没装」的排查就靠这句）', async () => {
    respond({ id: 'manim', status: 'missing', path: null, version: '', detail: 'PATH 里找不到 manim' })
    const result = await probeEnv('manim')
    expect(result.status).toBe('missing')
    expect(result.detail).toBe('PATH 里找不到 manim')
  })

  it('HTTP 失败要抛——抛错才会把这一行标成出错，而不是误报成「这项没装」', async () => {
    respond(null, { ok: false, status: 500 })
    await expect(probeEnv('manim')).rejects.toThrow('HTTP 500')
  })

  it('连不上也要抛', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    await expect(probeEnv('manim')).rejects.toThrow('offline')
  })

  it('形状不对要抛', async () => {
    respond({ id: 'manim', status: 'weird' })
    await expect(probeEnv('manim')).rejects.toThrow('形状不对')
  })
})
