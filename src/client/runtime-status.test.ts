import { describe, expect, it } from 'vitest'
import type { EnvironmentStatus } from 'manim-live'
import {
  blocksRender,
  capabilityTone,
  chipsOf,
  katexTone,
  missingCapabilities,
  missingLabels,
  pendingHints,
  runtimeTone,
  type LocalEnvState,
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

describe('状态条的 chip', () => {
  const local = (state: LocalEnvState) => state

  it('四枚齐：本机 / 运行时 / 公式样式 / 浏览器能力', () => {
    const chips = chipsOf({ t, status: healthy, local: local({ phase: 'ready' }) })
    expect(chips.map((chip) => chip.id)).toEqual(['local', 'runtime', 'katex', 'caps'])
    expect(chips.map((chip) => chip.tone)).toEqual(['ok', 'ok', 'ok', 'ok'])
    expect(chips.some((chip) => chip.actionable)).toBe(false)
  })

  it('运行时没加载：空环、可点（点开能预热）', () => {
    const runtime = chipsOf({ t, status: status({ runtime: { phase: 'idle', indexURL: null } }), local: local({ phase: 'ready' }) })
      .find((chip) => chip.id === 'runtime')
    expect(runtime?.tone).toBe('empty')
    expect(runtime?.value).toBe('rtIdle')
    expect(runtime?.actionable).toBe(true)
  })

  it('运行时加载中：转圈、不可点（没什么可做的）', () => {
    const runtime = chipsOf({ t, status: status({ runtime: { phase: 'loading', indexURL: null } }), local: local({ phase: 'ready' }) })
      .find((chip) => chip.id === 'runtime')
    expect(runtime?.tone).toBe('busy')
    expect(runtime?.actionable).toBe(false)
  })

  it('公式样式加载失败：红、可点；未配置则不可点（不是错）', () => {
    const failed = chipsOf({ t, status: status({ katex: { baseURL: 'x', phase: 'error', error: '404' } }), local: local({ phase: 'ready' }) })
      .find((chip) => chip.id === 'katex')
    expect(failed?.tone).toBe('error')
    expect(failed?.detail).toBe('404')
    expect(failed?.actionable).toBe(true)

    const unconfigured = chipsOf({ t, status: status({ katex: { baseURL: null, phase: 'unconfigured' } }), local: local({ phase: 'ready' }) })
      .find((chip) => chip.id === 'katex')
    expect(unconfigured?.tone).toBe('empty')
    expect(unconfigured?.actionable).toBe(false)
  })

  it('缺两项能力：计数进状态词，逐条为什么进说明', () => {
    const caps = chipsOf({ t, status: status({ capabilities: { wasm: false, webgl: false, videoExport: true } }), local: local({ phase: 'ready' }) })
      .find((chip) => chip.id === 'caps')
    expect(caps?.tone).toBe('error')
    expect(caps?.value).toBe('chipMissing:{"count":2}')
    expect(caps?.detail).toBe('rtWasmWhy rtWebglWhy')
    expect(caps?.actionable).toBe(true)
  })

  it('本机环境：检测中转圈不可点、缺项黄可点、查不到灰可点', () => {
    const checking = chipsOf({ t, status: healthy, local: local({ phase: 'checking' }) }).find((chip) => chip.id === 'local')
    expect(checking?.tone).toBe('busy')
    expect(checking?.actionable).toBe(false)

    const missing = chipsOf({ t, status: healthy, local: local({ phase: 'missing', missing: [{ id: 'ffmpeg', detail: '' }] }) })
      .find((chip) => chip.id === 'local')
    expect(missing?.tone).toBe('warn')
    expect(missing?.value).toBe('chipMissing:{"count":1}')
    expect(missing?.actionable).toBe(true)

    const unknown = chipsOf({ t, status: healthy, local: local({ phase: 'unknown' }) }).find((chip) => chip.id === 'local')
    expect(unknown?.tone).toBe('idle')
    expect(unknown?.actionable).toBe(true)
  })
})

describe('展开面板里的待处理项', () => {
  it('运行时没加载：借核心包的 hints 之外再补一句「要先下载」', () => {
    const lines = pendingHints({ t, status: status({ runtime: { phase: 'idle', indexURL: null } }), local: { phase: 'ready' } })
    expect(lines).toContain('chipRuntimeCold')
  })

  it('加载中不补那句话（已经在做了，没什么可说的）', () => {
    const lines = pendingHints({ t, status: status({ runtime: { phase: 'loading', indexURL: null } }), local: { phase: 'ready' } })
    expect(lines).toEqual([])
  })

  it('本机缺项：拼上缺什么；与浏览器侧的 hints 并存', () => {
    const lines = pendingHints({
      t,
      status: status({ hints: ['浏览器侧那句'] }),
      local: { phase: 'missing', missing: [{ id: 'ffmpeg', detail: '' }, { id: '打不上名字的', detail: '' }] },
    })
    expect(lines[0]).toBe('浏览器侧那句')
    expect(lines[1]).toBe('chipLocalMissing:{"items":"envFfmpeg、打不上名字的"}')
  })
})

describe('缺项的可读名', () => {
  it('认识的 id 走文案，不认识的 id 原样显示（比空着强）', () => {
    expect(missingLabels([{ id: 'ffmpeg', detail: '' }], t)).toBe('envFfmpeg')
    expect(missingLabels([{ id: '新加的项', detail: '' }], t)).toBe('新加的项')
    expect(missingLabels([{ id: 'latex', detail: '' }, { id: 'dvisvgm', detail: '' }], t)).toBe('envLatex、envDvisvgm')
  })
})
