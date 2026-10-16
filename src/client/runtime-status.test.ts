import { describe, expect, it } from 'vitest'
import type { EnvironmentStatus } from 'manim-live'
import {
  blocksRender,
  capabilityTone,
  katexTone,
  missingCapabilities,
  runtimeTone,
} from './runtime-status'
import type { Translate } from './i18n'

/** 取词替身：把键与参数一起吐出来，于是「取了哪个键、传了什么参数」都被钉在断言里。 */
const t: Translate = (key, params) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`)

/** 一份「什么都好」的快照，各用例只改自己关心的那几项。 */
const healthy: EnvironmentStatus = {
  capabilities: { wasm: true, webgl: true, videoExport: true },
  runtime: { phase: 'ready', indexURL: 'https://example.test/pyodide/' },
  katex: { baseURL: 'https://example.test/katex/', phase: 'loaded' },
  packages: { fetching: [] },
  hints: [],
}

const status = (patch: Partial<EnvironmentStatus>): EnvironmentStatus => ({ ...healthy, ...patch })

describe('状态 → 色调', () => {
  it('运行时：就绪绿、加载转圈、失败红、未加载空环', () => {
    expect(runtimeTone('ready')).toBe('ok')
    expect(runtimeTone('loading')).toBe('busy')
    expect(runtimeTone('error')).toBe('error')
    expect(runtimeTone('idle')).toBe('empty')
  })

  it('KaTeX：已加载绿、未配置空环（不是错）、失败红', () => {
    expect(katexTone('loaded')).toBe('ok')
    expect(katexTone('unconfigured')).toBe('empty')
    expect(katexTone('loading')).toBe('busy')
    expect(katexTone('error')).toBe('error')
  })

  it('能力：在绿、缺红', () => {
    expect(capabilityTone(true)).toBe('ok')
    expect(capabilityTone(false)).toBe('error')
  })
})

describe('缺哪几项能力', () => {
  it('顺序固定：WebAssembly → WebGL → 录屏', () => {
    expect(missingCapabilities({ wasm: false, webgl: false, videoExport: false })).toEqual(['wasm', 'webgl', 'recorder'])
  })

  it('都在时是空数组', () => {
    expect(missingCapabilities({ wasm: true, webgl: true, videoExport: true })).toEqual([])
  })
})

describe('有没有挡住渲染的硬伤', () => {
  it('都好的时候没有', () => {
    expect(blocksRender(healthy)).toBe(false)
  })

  it('没 WebGL / 没 WebAssembly / 运行时失败 / 取包失败——任意一条都算', () => {
    expect(blocksRender(status({ capabilities: { wasm: true, webgl: false, videoExport: true } }))).toBe(true)
    expect(blocksRender(status({ capabilities: { wasm: false, webgl: true, videoExport: true } }))).toBe(true)
    expect(blocksRender(status({ runtime: { phase: 'error', indexURL: null } }))).toBe(true)
    expect(blocksRender(status({ packages: { fetching: [], lastError: '取包失败' } }))).toBe(true)
  })

  it('只缺录屏能力不算：它只影响浏览器录屏那一种导出', () => {
    expect(blocksRender(status({ capabilities: { wasm: true, webgl: true, videoExport: false } }))).toBe(false)
  })
})

