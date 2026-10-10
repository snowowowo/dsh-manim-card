// 实验场：左边语料清单、右边渲染预览，点哪条跑哪条、也可以一键按顺序跑完全部。
//
// 画布**不在这里**——渲染一律交给 `ManimCard`（聊天流用的同一个组件），
// 于是重播 / 查看代码 / 复制这些能力天然一致，不会再出现「页面这套和卡片那套不一样」。
// 同一时刻只挂一张卡：语料与自定义代码互斥（见下面的 mode），省得两块 WebGL 画布叠着跑。
//
// 页面只留控件；说明性长文案一律收进 `Tip`（悬停才出）。状态（结果 / 开关 / 代码 / 视图）
// 落 localStorage，中途崩了或刷新了不用从头再来。
//
// **语料是运行时向 Host 取的**（见 ./corpus），不在这份产物里：语料本体是开发期的回归网，
// 放在包外的插件仓 `_dev/`，正式安装里取到空表 —— 那时本页只剩「自定义代码」。
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, ClipboardCopy, Eraser, Info, Play, Square, Trash2, Undo2, X, Zap } from 'lucide-react'
import type { ManimExample } from '../core/py/examples.ts'
import { ManimCard, type CardResult } from './components/card'
import { Segmented } from './components/segmented'
import { Tip } from './components/tip'
import { useCopied } from './clipboard'
import { SHOTS_URL, useCorpus } from './corpus'
import { clearPackageCache } from './packages'
import type { ManimCardData } from './definition'
import type { Translate } from './i18n'
import {
  clearGround, clearMarks, loadGround, loadMarks, saveGround, saveMarks,
  type GroundMode, type ManualMark,
} from './storage'

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

/** 批量渲染时单条的最长等待：卡住不能把整轮拖死。 */
const TIMEOUT_MS = 60_000

/** 请求渲染什么：某条语料，或自由编辑里的一段。`run` 是递增的批次号（换 key 才会重跑）。 */
type Job = { kind: 'example'; id: string } | { kind: 'free'; code: string }
type Shown = Job & { run: number; fast: boolean }

/**
 * 是否符合预期。**reject 组的「失败」才是通过**——那组语料验的就是「当场拒掉、且说得清」，
 * 跑通了反而说明拦截失效了。红绿点、续跑、「通过 N 条」全都走这一个判据。
 */
function isPassed(example: ManimExample, result: CardResult | undefined): boolean {
  if (result === undefined) return false
  return example.expect === 'reject' ? !result.ok : result.ok
}

export function ManimPage({ t }: { t: Translate }) {
  const [restored] = useState(() => loadGround())
  const [mode, setMode] = useState<GroundMode>(restored.mode ?? 'examples')
  const [results, setResults] = useState<Record<string, CardResult>>(() => restored.results ?? {})
  const [source, setSource] = useState(restored.source ?? FREE_SAMPLE)
  const [fast, setFast] = useState(restored.fast ?? false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [shown, setShown] = useState<Shown | null>(null)
  const [running, setRunning] = useState(false)
  /** 批量进度：跑的是哪一批、到第几条。null = 没在批量跑。 */
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null)
  const [copied, copy] = useCopied()
  /** 清缓存的结果回执（null = 还没清过）。 */
  const [cacheNote, setCacheNote] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  /** 人工验证标注（对 / 不对）：与自动结果分开存、分开清（见 storage 的注释）。 */
  const [marks, setMarks] = useState<Record<string, ManualMark>>(() => loadMarks())
  /** 加载失败的截图（语料还在、图被删了）：按路径记下来就别再试了，免得控制台一直报 404。 */
  const [brokenShots, setBrokenShots] = useState<Record<string, true>>({})

  // 语料从 Host 取（见 ./corpus）：正式安装里是空表，本页退化成「自定义代码」。
  const corpusState = useCorpus()
  const corpus = corpusState.status === 'ready' ? corpusState.corpus : null
  const examples = corpus?.examples ?? []
  const groups = corpus?.groups ?? []
  /** 实际视图：语料不在（正式安装）时，只剩自定义代码那一半。 */
  const view: GroundMode = corpus === null ? 'free' : mode

  const runSeed = useRef(0)
  /** 批量渲染的取消信号：每开一轮 +1，循环每步都比一次，不等号就停。 */
  const token = useRef(0)
  /** 当前这条渲染完成的落点：批量循环 await 它。 */
  const waiter = useRef<((result: CardResult) => void) | null>(null)
  const timer = useRef<number | null>(null)

  // 语料是运行时取回来的，会在读完之后才露面：把认不出的 id 丢掉，
  // 否则清单上会挂着跑不到的孤儿结果（旧记录里可能留着已删语料的 id）。
  useEffect(() => {
    if (corpus === null) return
    const known = new Set(corpus.examples.map((item) => item.id))
    setResults((prev) => {
      const kept = Object.entries(prev).filter(([id]) => known.has(id))
      return kept.length === Object.keys(prev).length ? prev : Object.fromEntries(kept)
    })
    setMarks((prev) => {
      const kept = Object.entries(prev).filter(([id]) => known.has(id))
      return kept.length === Object.keys(prev).length ? prev : Object.fromEntries(kept)
    })
  }, [corpus])

  // 状态落盘：结果 / 开关 / 代码 / 视图任一变化都存。防抖是因为批量渲染时 results 会连变上百次。
  useEffect(() => {
    const pending = window.setTimeout(() => saveGround({ results, fast, source, mode }), 400)
    return () => window.clearTimeout(pending)
  }, [results, fast, source, mode])

  // 人工标注很小，直存即可。
  useEffect(() => saveMarks(marks), [marks])

  /** 标 / 清当前这条的人工标注（null = 清）。 */
  const setMark = (id: string, mark: ManualMark | null): void => {
    setMarks((prev) => {
      const next = { ...prev }
      if (mark === null) delete next[id]
      else next[id] = mark
      return next
    })
  }

  /** 只清人工标注——自动渲染结果不动。 */
  const clearAllMarks = (): void => {
    clearMarks()
    setMarks({})
  }

  /** 放掉正在等的那条（完成 / 超时 / 被停止 / 被换掉都走这里），超时器一并清掉。 */
  const settle = (result: CardResult): void => {
    const resolve = waiter.current
    waiter.current = null
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    resolve?.(result)
  }

  /** 切到某个任务并等它渲染完；返回结果（超时/被停止也给一个结果，循环不会吊死）。 */
  const render = (job: Job, useFast: boolean): Promise<CardResult> =>
    new Promise<CardResult>((resolve) => {
      settle({ ok: false, text: t('stopped') })
      waiter.current = resolve
      timer.current = window.setTimeout(() => settle({ ok: false, text: t('timeout') }), TIMEOUT_MS)
      runSeed.current += 1
      setShown({ ...job, run: runSeed.current, fast: useFast })
    })

  const handleResult = (job: Job, result: CardResult): void => {
    if (job.kind === 'example') setResults((prev) => ({ ...prev, [job.id]: result }))
    settle(result)
  }

  /**
   * 按顺序跑一批语料。**批量一律走极速**——批量要的是「哪几条不对」，不是看动画过程；
   * 一批 98 条按 run_time 真等要几分钟。
   */
  const runBatch = async (items: ManimExample[]): Promise<void> => {
    if (running || items.length === 0) return
    const mine = token.current + 1
    token.current = mine
    setRunning(true)
    setBatch({ done: 0, total: items.length })
    for (const [index, example] of items.entries()) {
      if (token.current !== mine) return
      setBatch({ done: index + 1, total: items.length })
      await render({ kind: 'example', id: example.id }, true)
    }
    if (token.current !== mine) return
    setRunning(false)
    setBatch(null)
  }

  const stop = (): void => {
    token.current += 1
    setRunning(false)
    setBatch(null)
    settle({ ok: false, text: t('stopped') })
  }

  const openExample = (id: string): void => {
    if (running) return
    void render({ kind: 'example', id }, fast)
  }

  const toggleFast = (): void => {
    const next = !fast
    setFast(next)
    // 开着的是「当前这条」的选项：切了开关就把手上这条按新口径重跑一遍，否则开关像没反应
    if (shown === null || running) return
    const job: Job = shown.kind === 'free' ? { kind: 'free', code: shown.code } : { kind: 'example', id: shown.id }
    void render(job, next)
  }

  const clearRecord = (): void => {
    if (running) return
    clearGround()
    setResults({})
    setSource(FREE_SAMPLE)
    settle({ ok: false, text: t('stopped') })
    setShown(null)
  }

  const emptySource = source.trim().length === 0

  const renderFree = (): void => {
    // 空代码卡片会直接落到「数据不完整」占位、不发结果，批量循环等它就白等 60 秒——这里先挡掉。
    if (running || emptySource) return
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
      console.error('[manim-renderer] 清包缓存失败:', error)
      setCacheNote(t('cacheClearFailed', { message: error instanceof Error ? error.message : String(error) }))
    } finally {
      setClearing(false)
    }
  }

  /** 正在展示什么（语料标题 / 自由编辑）——缺省 = 还没选，或这条不属于当前视图。 */
  const current: { data: ManimCardData; label: string; job: Job } | null = (() => {
    if (shown === null) return null
    if (shown.kind === 'free') {
      if (view !== 'free') return null
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
    if (view !== 'examples') return null
    const example = examples.find((item) => item.id === shown.id)
    return example === undefined
      ? null
      : {
          data: {
            python: example.python,
            callId: `${example.id}-${shown.run}`,
            stepKey: `${example.id}-${shown.run}`,
            seq: shown.run,
            live: true,
          },
          label: example.title,
          job: { kind: 'example', id: example.id },
        }
  })()

  const tried = examples.filter((item) => results[item.id] !== undefined)
  const failed = tried.filter((item) => !isPassed(item, results[item.id]))
  const pending = examples.filter((item) => !isPassed(item, results[item.id]))

  /** 正在展示的这条语料（自由编辑时为 undefined）——预期表现与人工标注都挂在它上面。 */
  const currentExample: ManimExample | undefined =
    shown !== null && shown.kind === 'example' && view === 'examples'
      ? examples.find((item) => item.id === shown.id)
      : undefined

  /** 人工标注的进度：对 / 不对各几条（与自动结果无关）。 */
  const markIds = Object.keys(marks)
  const marksPassed = markIds.filter((id) => marks[id] === 'pass').length
  const marksFailed = markIds.length - marksPassed

  /** 一键带走的文本：每条都写清语料文件路径，失败还附原文。 */
  const buildReport = (): string => {
    const lines = [t('reportTitle'), t('reportTime', { time: new Date().toLocaleString('zh-CN') })]
    if (tried.length === 0) {
      lines.push('', t('reportEmpty'))
      return lines.join('\n')
    }
    lines.push(t('reportSummary', {
      total: examples.length,
      tried: tried.length,
      passed: tried.length - failed.length,
      failed: failed.length,
    }))
    const section = (title: string, items: ManimExample[]): void => {
      if (items.length === 0) return
      lines.push('', title)
      for (const item of items) {
        lines.push(t('reportCase', {
          id: item.id,
          title: item.title,
          file: item.file,
          expect: item.expect,
        }))
        const result = results[item.id]
        if (result !== undefined && !result.ok) lines.push(t('reportError', { text: result.text }))
      }
    }
    section(t('reportFailed', { count: failed.length }), failed)
    section(t('reportPassed', { count: tried.length - failed.length }),
      tried.filter((item) => isPassed(item, results[item.id])))
    section(t('reportUntried', { count: pending.length }), pending)
    // 失败的附上原文：文件路径是定位，源码是直接可复现的那一份（就是那个文件的内容）。
    if (failed.length > 0) {
      lines.push('', t('reportSource'))
      for (const item of failed) {
        lines.push('', `# ${item.file}`, '```python', item.python, '```')
      }
    }
    return lines.join('\n')
  }

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

  /** 人工验证按钮组：标对 / 标不对 / 清本条。挂在正在展示的这条上——看到什么标什么。 */
  const markButtons = currentExample === undefined ? null : (() => {
    const mark = marks[currentExample.id]
    return (
      <span className="mr-expect-mark">
        <Tip label={t('markHint')} align="end">
          <span className="mr-expect-marktitle">{t('markTitle')}</span>
        </Tip>
        <Tip label={mark === 'pass' ? t('markPass') : t('markTitle')} align="end">
          <button
            className="mr-iconbtn mr-iconbtn-xs"
            type="button"
            data-mark={mark === 'pass' ? 'pass' : undefined}
            aria-label={t('markPass')}
            aria-pressed={mark === 'pass'}
            onClick={() => setMark(currentExample.id, mark === 'pass' ? null : 'pass')}
          >
            <Check size={13} strokeWidth={2} />
          </button>
        </Tip>
        <Tip label={mark === 'fail' ? t('markFail') : t('markTitle')} align="end">
          <button
            className="mr-iconbtn mr-iconbtn-xs"
            type="button"
            data-mark={mark === 'fail' ? 'fail' : undefined}
            aria-label={t('markFail')}
            aria-pressed={mark === 'fail'}
            onClick={() => setMark(currentExample.id, mark === 'fail' ? null : 'fail')}
          >
            <X size={13} strokeWidth={2} />
          </button>
        </Tip>
        {mark !== undefined && (
          <Tip label={t('markUnmark')} align="end">
            <button
              className="mr-iconbtn mr-iconbtn-xs"
              type="button"
              aria-label={t('markUnmark')}
              onClick={() => setMark(currentExample.id, null)}
            >
              <Undo2 size={13} strokeWidth={1.6} />
            </button>
          </Tip>
        )}
      </span>
    )
  })()

  /**
   * 上次真渲染的截图（`_dev/shots/<组>/<同名>.png`，由 scripts/shot-corpus.mjs 落盘）。
   *
   * 为什么值得占一块位置：自动结果只说明「没炸」，预期表现只说明「应该长什么样」——
   * 中间那一步「画面到底对不对」只有图能回答。图留盘上、与语料同名归档，这里直接显示，
   * 就不必每核一次重截一次；重跑截图脚本会覆盖同名文件，所以这里看到的永远是当前这版。
   * 点开在新标签页看原尺寸（1280×720）——布局类问题（贴到角上、字压字）在小图上不好认。
   */
  const shotRel = currentExample?.shot
  const shotFigure = shotRel === undefined || brokenShots[shotRel] === true
    ? null
    : (
      <figure className="mr-shot">
        <figcaption className="mr-shot-label">
          <Tip label={t('shotHint')} align="start">
            <span>{t('shotLabel')}</span>
          </Tip>
        </figcaption>
        <a className="mr-shot-link" href={`${SHOTS_URL}/${shotRel}`} target="_blank" rel="noreferrer">
          <img
            className="mr-shot-img"
            src={`${SHOTS_URL}/${shotRel}`}
            alt={shotRel}
            loading="lazy"
            onError={() => setBrokenShots((prev) => ({ ...prev, [shotRel]: true }))}
          />
        </a>
      </figure>
    )

  const preview = (
    <section className="mr-preview">
      {currentExample !== undefined && (
        <div className="mr-expect">
          <Tip label={t('expectHint')} align="start">
            <span className="mr-expect-label">{t('expectLabel')}</span>
          </Tip>
          <span className="mr-expect-text">
            {currentExample.expectation ?? '（这条语料还没写预期表现——对照 Manim 文档与常识核）'}
          </span>
          {markButtons}
        </div>
      )}
      {shotFigure}
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

  // 语料从本机路由取，正常是毫秒级；取到之前不渲染工作区，免得先闪一下「自定义代码」再跳回去。
  if (corpusState.status === 'loading') {
    return (
      <div className="mr-page">
        <header className="mr-page-head">
          <div className="mr-head-title">
            <h1 className="mr-page-title">{t('title')}</h1>
          </div>
        </header>
        <p className="mr-empty">{t('corpusLoading')}</p>
      </div>
    )
  }

  /** 语料不在时（正式安装）显示的原因：这不是故障，是有意的降级。 */
  const notice = corpus !== null
    ? null
    : corpusState.status === 'devOnly'
      ? t('corpusDevOnly')
      : t('corpusError', { message: corpusState.status === 'error' ? corpusState.message : '' })

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
        {corpus !== null && (
          <Segmented
            value={mode}
            onChange={setMode}
            label={t('modeLabel')}
            disabled={running}
            options={[
              { value: 'examples', label: t('modeGround') },
              { value: 'free', label: t('modeFree') },
            ]}
          />
        )}
      </header>

      {view === 'examples' ? (
        <div className="mr-workspace">
          <aside className="mr-side">
            <div className="mr-toolbar">
              <Tip label={t('renderAllHint')} align="start">
                <button
                  className="mr-btn primary"
                  type="button"
                  disabled={running || pending.length === 0}
                  onClick={() => void runBatch(pending)}
                >
                  <Play size={13} strokeWidth={1.8} aria-hidden="true" />
                  {t('renderAll')}
                </button>
              </Tip>
              {running && (
                <Tip label={t('stopAllHint')} align="start">
                  <button className="mr-iconbtn" type="button" aria-label={t('stopAll')} onClick={stop}>
                    <Square size={14} strokeWidth={1.6} />
                  </button>
                </Tip>
              )}
              <Tip label={tried.length === 0 ? t('copyReportEmpty') : t('copyReportHint')} align="start">
                <button
                  className="mr-iconbtn"
                  type="button"
                  disabled={tried.length === 0}
                  aria-label={t('copyReport')}
                  onClick={() => copy(buildReport())}
                >
                  <ClipboardCopy size={15} strokeWidth={1.6} />
                </button>
              </Tip>
              <Tip label={t('clearRecordHint')} align="start">
                <button className="mr-iconbtn" type="button" aria-label={t('clearRecord')} onClick={clearRecord}>
                  <Trash2 size={15} strokeWidth={1.6} />
                </button>
              </Tip>
              {markIds.length > 0 && (
                <Tip label={t('marksClearHint')} align="start">
                  <button className="mr-iconbtn" type="button" aria-label={t('marksClear')} onClick={clearAllMarks}>
                    <Undo2 size={15} strokeWidth={1.6} />
                  </button>
                </Tip>
              )}
              {fastToggle}
              {cacheButton}
              <span className="mr-toolbar-count">
                {batch === null
                  ? (tried.length === 0
                      ? t('groundCountIdle')
                      : t('groundCount', {
                          passed: tried.length - failed.length,
                          failed: failed.length,
                          total: examples.length,
                        }))
                  : `${batch.done} / ${batch.total}`}
              </span>
              {markIds.length > 0 && (
                <span className="mr-toolbar-count">
                  {t('marksCount', { passed: marksPassed, failed: marksFailed })}
                </span>
              )}
              {cacheNote !== null && <span className="mr-toolbar-note" role="status">{cacheNote}</span>}
            </div>

            <div className="mr-side-scroll">
              {groups.map((group) => {
                const items = examples.filter((item) => item.group === group.id)
                if (items.length === 0) return null
                const groupPassed = items.filter((item) => isPassed(item, results[item.id])).length
                const groupFailed = items.filter(
                  (item) => results[item.id] !== undefined && !isPassed(item, results[item.id]),
                ).length
                const groupPending = items.filter((item) => !isPassed(item, results[item.id]))
                const open = collapsed[group.id] !== true
                return (
                  <div className="mr-ground-group" key={group.id}>
                    <div className="mr-ground-grouphead">
                      <button
                        className="mr-ground-toggle"
                        type="button"
                        aria-expanded={open}
                        title={open ? t('collapseGroup') : t('expandGroup')}
                        onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: open }))}
                      >
                        {open
                          ? <ChevronDown size={13} strokeWidth={1.8} aria-hidden="true" />
                          : <ChevronRight size={13} strokeWidth={1.8} aria-hidden="true" />}
                        <span className="mr-ground-grouptitle">{group.title}</span>
                        <span className="mr-ground-gcount">{groupPassed}/{items.length}</span>
                        {groupFailed > 0 && <span className="mr-ground-gfail">{groupFailed}</span>}
                        {group.network === true && <span className="mr-ground-net">{t('netBadge')}</span>}
                      </button>
                      <button
                        className="mr-iconbtn mr-iconbtn-xs mr-ground-run"
                        type="button"
                        disabled={running || groupPending.length === 0}
                        aria-label={t('runGroup')}
                        title={t('runGroupHint')}
                        onClick={() => void runBatch(groupPending)}
                      >
                        <Play size={12} strokeWidth={1.8} />
                      </button>
                    </div>
                    {open && (
                      <div className="mr-ground-items">
                        {items.map((item) => {
                          const result = results[item.id]
                          const state = result === undefined ? 'idle' : isPassed(item, result) ? 'ok' : 'fail'
                          const mark = marks[item.id]
                          return (
                            <button
                              className="mr-ground-item"
                              key={item.id}
                              type="button"
                              data-state={state}
                              aria-pressed={shown?.kind === 'example' && shown.id === item.id}
                              title={
                                [item.id, item.expectation, item.note].filter((part) => part !== undefined).join('\n')
                              }
                              onClick={() => openExample(item.id)}
                            >
                              <span className="mr-ground-dot" aria-hidden="true" />
                              <span className="mr-ground-name">{item.title}</span>
                              {mark !== undefined && (
                                <span className={`mr-ground-mark ${mark === 'pass' ? 'is-pass' : 'is-fail'}`} aria-hidden="true">
                                  {mark === 'pass' ? '✓' : '✗'}
                                </span>
                              )}
                              <span className="mr-ground-id">{item.id}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </aside>

          <main className="mr-main">{preview}</main>
        </div>
      ) : (
        <div className="mr-workspace mr-workspace-free">
          <aside className="mr-side">
            {notice !== null && <p className="mr-ground-notice">{notice}</p>}
            <textarea
              className="mr-code mr-code-fill"
              spellCheck={false}
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
            <div className="mr-toolbar">
              <button
                className="mr-btn primary"
                type="button"
                disabled={running || emptySource}
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
