// 实验场（功能验收台）：左边样例清单、右边渲染预览，点哪条跑哪条。
//
// 页面的定位是**验收本插件在宿主里的功能表现**——卡片渲染、播放控制、查看代码、导出 mp4、
// 预检报错，全部走「样例 / 自定义代码」两种模式。样例是打进插件的一小集（见 ./samples），
// 正式安装里照样可用；236 条那套语料回归网归核心包 manim-live 仓所有，与本页无关。
//
// 画布**不在这里**——渲染一律交给 `ManimCard`（聊天流用的同一个组件），
// 于是重播 / 查看代码 / 导出这些能力天然一致，不会再出现「页面这套和卡片那套不一样」。
// 同一时刻只挂一张卡：样例与自定义代码互斥（见下面的 mode），省得两块 WebGL 画布叠着跑。
//
// 页面只留控件；说明性长文案一律收进 `Tip`（悬停才出）。状态（结果 / 开关 / 代码 / 模式）
// 落 localStorage，中途崩了或刷新了不用从头再来。
import { useEffect, useRef, useState } from 'react'
import { Eraser, Info, Play, Square, Trash2, Zap } from 'lucide-react'
import { ManimCard, type CardResult } from './components/card'
import { Segmented } from './components/segmented'
import { Tip } from './components/tip'
import { clearPackageCache } from './packages'
import { SAMPLES, type LabSample } from './samples'
import type { ManimCardData } from './definition'
import type { Translate } from './i18n'
import { clearLab, loadLab, saveLab, type LabMode, type LabResult } from './storage'

/** 自由编辑的起手样本：坐标系 + 圆 + 公式，顺带验证 KaTeX 字体路由。 */
const FREE_SAMPLE = `ax = Axes(x_range=[-2, 2, 1], y_range=[-2, 2, 1])
circle = Circle(radius=1)
circle.move_to(ax.c2p(0, 0, 0))
circle.set_color("#247bbf")
self.add(ax, circle)
self.play(Create(ax), Create(circle))

eq = MathTex(latex=["x^2", "+", "y^2", "=", "1"], font_size=34)
eq.move_to(ax.c2p(0, 1.5, 0))
self.play(Write(eq))
`

/** 单次渲染的最长等待：卡住不能把页面吊死。 */
const TIMEOUT_MS = 60_000

/** 请求渲染什么：某条样例，或自由编辑里的一段。`run` 是递增的批次号（换 key 才会重跑）。 */
type Job = { kind: 'sample'; id: string } | { kind: 'free'; code: string }
type Shown = Job & { run: number; fast: boolean }

/**
 * 是否符合预期。**reject 样例的「失败」才是通过**——那条验的就是「当场拒掉、且说得清」，
 * 跑通了反而说明拦截失效了。红绿点、「通过 N 条」全走这一个判据。
 */
function isPassed(sample: LabSample, result: LabResult | undefined): boolean {
  if (result === undefined) return false
  return sample.reject === true ? !result.ok : result.ok
}

export function ManimPage({ t }: { t: Translate }) {
  const [restored] = useState(() => loadLab())
  const [mode, setMode] = useState<LabMode>(restored.mode ?? 'samples')
  const [results, setResults] = useState<Record<string, LabResult>>(() => restored.results ?? {})
  const [source, setSource] = useState(restored.source ?? FREE_SAMPLE)
  const [fast, setFast] = useState(restored.fast ?? false)
  const [shown, setShown] = useState<Shown | null>(null)
  const [running, setRunning] = useState(false)
  /** 清缓存的结果回执（null = 还没清过）。 */
  const [cacheNote, setCacheNote] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  const runSeed = useRef(0)
  /** 当前这条渲染完成的落点。 */
  const waiter = useRef<((result: CardResult) => void) | null>(null)
  const timer = useRef<number | null>(null)

  // 状态落盘：结果 / 开关 / 代码 / 模式任一变化都存（防抖，结果会连着变）。
  useEffect(() => {
    const pending = window.setTimeout(() => saveLab({ results, fast, source, mode }), 400)
    return () => window.clearTimeout(pending)
  }, [results, fast, source, mode])

  /** 放掉正在等的那条（完成 / 超时 / 被停止 / 被换掉都走这里），超时器一并清掉。 */
  const settle = (result: CardResult): void => {
    const resolve = waiter.current
    waiter.current = null
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    setRunning(false)
    resolve?.(result)
  }

  /** 切到某个任务并等它渲染完；返回结果（超时/被停止也给一个结果，不会吊死）。 */
  const render = (job: Job, useFast: boolean): Promise<CardResult> =>
    new Promise<CardResult>((resolve) => {
      settle({ ok: false, text: t('stopped') })
      waiter.current = resolve
      timer.current = window.setTimeout(() => settle({ ok: false, text: t('timeout') }), TIMEOUT_MS)
      runSeed.current += 1
      setRunning(true)
      setShown({ ...job, run: runSeed.current, fast: useFast })
    })

  const handleResult = (job: Job, result: CardResult): void => {
    if (job.kind === 'sample') setResults((prev) => ({ ...prev, [job.id]: { ok: result.ok } }))
    settle(result)
  }

  const stop = (): void => {
    settle({ ok: false, text: t('stopped') })
    setShown(null)
  }

  /** 换模式先放掉手上这条：不然卡片跟着旧模式消失、等待却要吊到超时。 */
  const switchMode = (next: LabMode): void => {
    if (next === mode) return
    settle({ ok: false, text: t('stopped') })
    setShown(null)
    setMode(next)
  }

  const openSample = (id: string): void => {
    void render({ kind: 'sample', id }, fast)
  }

  const toggleFast = (): void => {
    const next = !fast
    setFast(next)
    // 开着的是「当前这条」的选项：切了开关就把手上这条按新口径重跑一遍，否则开关像没反应
    if (shown === null) return
    const job: Job = shown.kind === 'free' ? { kind: 'free', code: shown.code } : { kind: 'sample', id: shown.id }
    void render(job, next)
  }

  const clearRecord = (): void => {
    clearLab()
    setResults({})
    setSource(FREE_SAMPLE)
    settle({ ok: false, text: t('stopped') })
    setShown(null)
  }

  const emptySource = source.trim().length === 0

  const renderFree = (): void => {
    // 空代码卡片会直接落到「数据不完整」占位、不发结果——先挡掉，别白挂一张卡。
    if (emptySource) return
    void render({ kind: 'free', code: source }, fast)
  }

  /** 清掉本机缓存的按需包：想验「首次取包」就得先把缓存清干净。 */
  const clearCache = async (): Promise<void> => {
    if (clearing) return
    setClearing(true)
    try {
      const removed = await clearPackageCache()
      setCacheNote(t('cacheCleared', { count: removed.length }))
    } catch (error) {
      console.error('[manim-live] 清包缓存失败:', error)
      setCacheNote(t('cacheClearFailed', { message: error instanceof Error ? error.message : String(error) }))
    } finally {
      setClearing(false)
    }
  }

  /** 正在展示什么（样例标题 / 自由编辑）——缺省 = 还没选，或这条不属于当前模式。 */
  const current: { data: ManimCardData; label: string; job: Job } | null = (() => {
    if (shown === null) return null
    if (shown.kind === 'free') {
      if (mode !== 'free') return null
      return {
        // live：这一条是用户**刚要求**渲染的（不是打开历史会话时回填出来的卡），
        // 值得放一次真动画。callId 带 run 号——每条各算一张，重跑一次就重新播。
        // stepKey 用它自己：实验场一次只挂一张卡，不该跟谁凑成一批（「一批只播一张」是聊天流
        // 那边为并行调用定的规矩，这里套上去只会把用户的每一次点击都吃掉）。
        data: { python: shown.code, callId: `free-${shown.run}`, stepKey: `free-${shown.run}`, seq: shown.run, live: true },
        label: t('freeLabel'),
        job: { kind: 'free', code: shown.code },
      }
    }
    if (mode !== 'samples') return null
    const sample = SAMPLES.find((item) => item.id === shown.id)
    return sample === undefined
      ? null
      : {
          data: {
            python: sample.python,
            callId: `${sample.id}-${shown.run}`,
            stepKey: `${sample.id}-${shown.run}`,
            seq: shown.run,
            live: true,
          },
          label: sample.title,
          job: { kind: 'sample', id: sample.id },
        }
  })()

  /** 正在展示的这条样例（自由编辑时为 undefined）——expect 对照条挂在它上面。 */
  const currentSample: LabSample | undefined =
    shown !== null && shown.kind === 'sample' && mode === 'samples'
      ? SAMPLES.find((item) => item.id === shown.id)
      : undefined

  const tried = SAMPLES.filter((item) => results[item.id] !== undefined)
  const failed = tried.filter((item) => !isPassed(item, results[item.id]))

  const fastToggle = (
    <Tip label={t('fastHint')} align="start">
      <button
        className="mr-iconbtn"
        type="button"
        aria-pressed={fast}
        aria-label={t('fastOn')}
        onClick={toggleFast}
      >
        <Zap size={15} strokeWidth={1.6} />
      </button>
    </Tip>
  )

  /** 清包缓存：开发期验「首次取包」用的——不清的话那条路只走得到一次。 */
  const cacheButton = (
    <Tip label={t('clearCacheHint')} align="start">
      <button
        className="mr-iconbtn"
        type="button"
        disabled={clearing}
        aria-label={t('clearCache')}
        onClick={() => void clearCache()}
      >
        <Eraser size={15} strokeWidth={1.6} />
      </button>
    </Tip>
  )

  const preview = (
    <section className="mr-preview">
      {currentSample !== undefined && (
        <div className="mr-expect">
          <Tip label={t('expectHint')} align="start">
            <span className="mr-expect-label">{t('expectLabel')}</span>
          </Tip>
          <span className="mr-expect-text">{currentSample.expect}</span>
        </div>
      )}
      {current === null
        ? <p className="mr-empty">{t('previewEmpty')}</p>
        : (
          <ManimCard
            key={current.data.callId}
            data={current.data}
            t={t}
            label={current.label}
            autoStart
            fast={shown?.fast === true}
            onResult={(result) => handleResult(current.job, result)}
          />
        )}
    </section>
  )

  return (
    <div className="mr-page">
      <header className="mr-page-head">
        <div className="mr-head-title">
          <h1 className="mr-page-title">{t('title')}</h1>
          <Tip label={t('lead')} align="start">
            <button className="mr-iconbtn" type="button" aria-label={t('lead')}>
              <Info size={15} strokeWidth={1.6} />
            </button>
          </Tip>
        </div>
        <Segmented
          value={mode}
          onChange={switchMode}
          label={t('modeLabel')}
          options={[
            { value: 'samples', label: t('modeSamples') },
            { value: 'free', label: t('modeFree') },
          ]}
        />
      </header>

      {mode === 'samples' ? (
        <div className="mr-workspace">
          <aside className="mr-side">
            <div className="mr-toolbar">
              {running && (
                <Tip label={t('stopHint')} align="start">
                  <button className="mr-iconbtn" type="button" aria-label={t('stop')} onClick={stop}>
                    <Square size={14} strokeWidth={1.6} />
                  </button>
                </Tip>
              )}
              <Tip label={t('clearRecordHint')} align="start">
                <button className="mr-iconbtn" type="button" aria-label={t('clearRecord')} onClick={clearRecord}>
                  <Trash2 size={15} strokeWidth={1.6} />
                </button>
              </Tip>
              {fastToggle}
              {cacheButton}
              <span className="mr-toolbar-count">
                {tried.length === 0
                  ? t('sampleCountIdle')
                  : t('sampleCount', {
                      passed: tried.length - failed.length,
                      failed: failed.length,
                      total: SAMPLES.length,
                    })}
              </span>
              {cacheNote !== null && <span className="mr-toolbar-note" role="status">{cacheNote}</span>}
            </div>

            <div className="mr-side-scroll">
              <div className="mr-ground-items">
                {SAMPLES.map((sample) => {
                  const result = results[sample.id]
                  const state = result === undefined ? 'idle' : isPassed(sample, result) ? 'ok' : 'fail'
                  return (
                    <button
                      className="mr-ground-item"
                      key={sample.id}
                      type="button"
                      data-state={state}
                      aria-pressed={shown?.kind === 'sample' && shown.id === sample.id}
                      title={[sample.id, sample.expect].join('\n')}
                      onClick={() => openSample(sample.id)}
                    >
                      <span className="mr-ground-dot" aria-hidden="true" />
                      <span className="mr-ground-name">{sample.title}</span>
                      <span className="mr-ground-id">{sample.id}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>

          <main className="mr-main">{preview}</main>
        </div>
      ) : (
        <div className="mr-workspace mr-workspace-free">
          <aside className="mr-side">
            <textarea
              className="mr-code mr-code-fill"
              spellCheck={false}
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
            <div className="mr-toolbar">
              {running && (
                <Tip label={t('stopHint')} align="start">
                  <button className="mr-iconbtn" type="button" aria-label={t('stop')} onClick={stop}>
                    <Square size={14} strokeWidth={1.6} />
                  </button>
                </Tip>
              )}
              <button
                className="mr-btn primary"
                type="button"
                disabled={emptySource}
                onClick={renderFree}
              >
                <Play size={13} strokeWidth={1.8} aria-hidden="true" />
                {t('render')}
              </button>
              <Tip label={t('sourceHint')} align="start">
                <button className="mr-iconbtn" type="button" aria-label={t('sourceHint')}>
                  <Info size={15} strokeWidth={1.6} />
                </button>
              </Tip>
              {fastToggle}
              {cacheButton}
              {cacheNote !== null && <span className="mr-toolbar-note" role="status">{cacheNote}</span>}
            </div>
          </aside>

          <main className="mr-main">{preview}</main>
        </div>
      )}
    </div>
  )
}
