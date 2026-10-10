// 设置页：本机环境 + Pyodide 包缓存。
//
// 两件事放一页，因为它们回答的是同一个问题——「要真的用起来，这台机器还缺什么」：
// 上面一块是本机装的 Manim / FFmpeg / LaTeX（**导出**要走它们，桥里的 Pyodide 没有这些），
// 下面一块是桥要用的 Python 包（渲染时按需取，现在能看到、也能提前取回来）。
//
// 取数一律**逐项来**（环境一项一个请求、预缓存一个包一个请求），所以界面是逐行亮起来的，
// 中途失败只影响那一行；同时只允许一个预缓存任务在跑（下载是重活，别叠着来）。
//
// 样式只用宿主 `--dsw-alias-*` token（明暗双主题自动成立），类名统一 `mr-` 前缀；
// 说明性长文案一律进悬浮提示（`Tip`），页面上只留控件与数值。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { Tip } from './components/tip'
import { useCopied } from './clipboard'
import { loadEnvPlan, probeEnv, type EnvCheck, type EnvPlan, type EnvResult, type EnvStatus } from './environment'
import {
  cachePackage, clearPackage, COMMON_PACKAGES, findPackage, formatBytes, loadPackages, prefetchPlan, stateKey,
  type PackageEntry, type PackageInventory, type PackageState,
} from './packages'
import type { Translate } from './i18n'

/** 状态点的语义（与宿主 StateDot 同一套）：绿=好、黄=要注意、红=错、灰=中性、空环=没有、转圈=进行中。 */
type Tone = 'ok' | 'warn' | 'error' | 'idle' | 'empty' | 'busy'

/**
 * 状态点：宿主 `StateDot` 的配方抄一份——宿主 UI 包禁止 import（引了槽位会整体崩）。
 * 进行中是那只 1.5 秒一圈的环；空环（`empty`）表示「本地没有」，与灰色实心的「中性」区分开。
 */
function Dot({ tone }: { tone: Tone }) {
  if (tone === 'busy') {
    return (
      <svg className="mr-set-spin" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <g className="mr-set-spin-rotor">
          <circle className="mr-set-spin-track" cx="12" cy="12" r="9.5" />
          <circle className="mr-set-spin-arc" cx="12" cy="12" r="9.5" />
        </g>
      </svg>
    )
  }
  return <span className="mr-set-dot" data-tone={tone} aria-hidden="true" />
}

/** 只读徽章：宿主 `Tag` 的配方（胶囊、11px/17px、tone 决定底色与字色）。 */
function Tag({ tone, children }: { tone: 'outline' | 'neutral' | 'success'; children: string }) {
  return <span className="mr-tag" data-tone={tone}>{children}</span>
}

/** 一个包该画什么点：取回来的绿、随包的灰、没缓存的空环。 */
function packageTone(state: PackageState): Tone {
  return state === 'cached' ? 'ok' : state === 'bundled' ? 'idle' : 'empty'
}

function packageTagTone(state: PackageState): 'outline' | 'neutral' | 'success' {
  return state === 'cached' ? 'success' : state === 'bundled' ? 'neutral' : 'outline'
}

const envTone = (status: EnvStatus): Tone => (status === 'ok' ? 'ok' : status === 'missing' ? 'warn' : 'error')

/**
 * 探测项 id → 文案键。**写死这张表**是为了不去拼键名（拼出来的键查不到就成了空白文案）。
 * Host 加了新探测项而这张表还没跟上时，退化成直接显示 id —— 比空着强，也一眼看得出要补文案。
 */
const ENV_COPY: Record<string, { title: string; why: string }> = {
  python3: { title: 'envPython3', why: 'envPython3Why' },
  manim: { title: 'envManim', why: 'envManimWhy' },
  manimModule: { title: 'envManimModule', why: 'envManimModuleWhy' },
  ffmpeg: { title: 'envFfmpeg', why: 'envFfmpegWhy' },
  latex: { title: 'envLatex', why: 'envLatexWhy' },
  dvisvgm: { title: 'envDvisvgm', why: 'envDvisvgmWhy' },
}

const envTitleKey = (id: string): string => ENV_COPY[id]?.title ?? id
const envWhyKey = (id: string): string => ENV_COPY[id]?.why ?? id

/** 环境行的右侧数值：就绪给版本，没装/出错给状态词（版本行可能很长，界面上要留得住）。 */
function envValue(t: Translate, result: EnvResult): string {
  if (result.status === 'ok') return result.version
  return result.status === 'missing' ? t('envMissing') : t('envError')
}

// ---------------------------------------------------------------- 本机环境

/**
 * 本机环境卡片：逐项探测，逐行亮起来。
 *
 * 探测顺序就是 Host 给的顺序（python3 → manim → manim 包 → ffmpeg → latex → dvisvgm），
 * 一项失败标记那一行、继续下一项——一项超时不该让整块卡住。
 */
function EnvCard({ t }: { t: Translate }) {
  const [plan, setPlan] = useState<EnvPlan | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, EnvResult>>({})
  const [running, setRunning] = useState(false)
  const alive = useRef(true)

  useEffect(() => () => { alive.current = false }, [])

  const run = useCallback(async (target: EnvPlan): Promise<void> => {
    setResults({})
    setRunning(true)
    for (const check of target.checks) {
      let result: EnvResult
      try {
        result = await probeEnv(check.id)
      } catch (error) {
        console.error(`[manim-renderer] 探测 ${check.id} 失败：`, error)
        result = { id: check.id, status: 'error', path: null, version: '', detail: error instanceof Error ? error.message : String(error) }
      }
      if (!alive.current) return
      setResults((previous) => ({ ...previous, [check.id]: result }))
    }
    if (alive.current) setRunning(false)
  }, [])

  const load = useCallback(async (): Promise<void> => {
    setFailure(null)
    setPlan(null)
    try {
      const next = await loadEnvPlan()
      if (!alive.current) return
      setPlan(next)
      void run(next)
    } catch (error) {
      console.error('[manim-renderer] 取环境探测计划失败：', error)
      if (alive.current) setFailure(error instanceof Error ? error.message : String(error))
    }
  }, [run])

  useEffect(() => { void load() }, [load])

  const ready = Object.values(results).filter((result) => result.status === 'ok').length
  const total = plan?.checks.length ?? 0

  return (
    <div className="mr-set-card">
      <div className="mr-set-head">
        <h2 className="mr-set-title">{t('envTitle')}</h2>
        <span className="mr-set-meta">
          {plan === null ? t('loading') : t('envReady', { ready, total })}
        </span>
        <Tip label={t('envRerunHint')} align="end">
          <button type="button" className="mr-iconbtn mr-iconbtn-xs" disabled={running}
            aria-label={t('envRerun')} onClick={() => { void load() }}>
            <RefreshCw size={13} />
          </button>
        </Tip>
      </div>

      {failure !== null && (
        <p className="mr-set-error" role="status">{t('envPlanFailed', { message: failure })}</p>
      )}
      {failure === null && plan === null && (
        <p className="mr-set-empty" role="status">{t('envProbing')}</p>
      )}

      {plan !== null && (
        <div className="mr-set-list">
          {plan.checks.map((check) => {
            const result = results[check.id]
            const tone: Tone = result === undefined ? 'busy' : envTone(result.status)
            return (
              <div key={check.id} className="mr-set-row" data-kind="env" data-tone={tone}>
                <Dot tone={tone} />
                <Tip label={envHint(t, check, result)} align="start">
                  <span className="mr-set-name">{t(envTitleKey(check.id))}</span>
                </Tip>
                <span className="mr-set-detail">{envDetail(t, result)}</span>
                <span className="mr-set-size">{result === undefined ? '' : envValue(t, result)}</span>
              </div>
            )
          })}
        </div>
      )}

      {plan !== null && (
        <Tip label={plan.path} align="start">
          <span className="mr-set-note">{t('envPathNote')}</span>
        </Tip>
      )}
    </div>
  )
}

/** 环境行的悬浮说明：为什么看这一项（+ 实际跑过哪条命令，让「到底测了什么」不是个谜）。 */
function envHint(t: Translate, check: EnvCheck, result: EnvResult | undefined): string {
  const lines = [t(envWhyKey(check.id)), t('envRan', { command: check.command })]
  if (result !== undefined && result.status !== 'ok' && result.detail.length > 0) lines.push(result.detail)
  return lines.join('\n')
}

/** 环境行的中列：找到了给路径，否则给原因。 */
function envDetail(t: Translate, result: EnvResult | undefined): string {
  if (result === undefined) return t('envProbing')
  if (result.status === 'ok') return result.path ?? ''
  return result.detail.length > 0 ? result.detail : t('envMissing')
}

// ---------------------------------------------------------------- 包缓存

/**
 * 包缓存卡片：一张常用包短清单 + 一个手动输入框，外加「按行清理」。
 *
 * 为什么不是全表：lock 里有近三百条，绝大多数人一辈子用不到——把常用的摆出来，
 * 比让人在一个长列表里筛要快。**列表不是白名单**：清单里没有的包，直接写上名字就能取，
 * 走的是同一条预缓存通道（也照样连依赖一起取）。手输过的包会留在表里，
 * 于是「取回来了、想再清掉」这条路也在同一张表上闭环。
 *
 * 取/清都就地重问一次 Host（状态以后端为准），不本地猜。
 */
function PackagesCard({ t }: { t: Translate }) {
  const [inventory, setInventory] = useState<PackageInventory | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [extra, setExtra] = useState<string[]>([])
  const [busy, setBusy] = useState<{ name: string; done: number; total: number } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [copied, copy] = useCopied()
  const alive = useRef(true)

  useEffect(() => () => { alive.current = false }, [])

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const next = await loadPackages()
      if (!alive.current) return
      setInventory(next)
      setFailure(null)
    } catch (error) {
      console.error('[manim-renderer] 取包清单失败：', error)
      if (alive.current) setFailure(error instanceof Error ? error.message : String(error))
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const entries = inventory?.entries ?? []

  /** 表上要画的：常用那几个（固定顺序）+ 用户手输过的（去重、且不在常用里的）。 */
  const shown = useMemo(() => {
    const common: PackageEntry[] = []
    const listed = new Set<string>()
    for (const name of COMMON_PACKAGES) {
      const entry = findPackage(entries, name)
      if (entry !== undefined) { common.push(entry); listed.add(entry.name) }
    }
    for (const name of extra) {
      const entry = findPackage(entries, name)
      if (entry !== undefined && !listed.has(entry.name)) { common.push(entry); listed.add(entry.name) }
    }
    return common
  }, [entries, extra])

  const counts = useMemo(() => {
    let bundled = 0
    let cached = 0
    let bytes = 0
    for (const entry of entries) {
      if (entry.state === 'bundled') bundled += 1
      else if (entry.state === 'cached') { cached += 1; bytes += entry.bytes ?? 0 }
    }
    return { bundled, cached, bytes }
  }, [entries])

  /** 把它摆到表上（手输过的包留在表里，便于回头清理）。 */
  const surface = (name: string): void => {
    setExtra((previous) => (previous.includes(name) ? previous : [...previous, name]))
  }

  /**
   * 取一个包（连依赖）：先算闭包，再一个一个取，进度落在按钮上。
   * 名字不认识 / 已经在本机都当场说清楚，不去发无谓的请求。
   */
  const fetchPackages = async (name: string, clearInput = false): Promise<void> => {
    if (name.length === 0 || busy !== null) return
    setNote(null)
    if (findPackage(entries, name) === undefined) {
      setNote(t('pkgUnknown', { name }))
      return
    }
    surface(name)
    const plan = prefetchPlan(entries, name)
    if (plan.length === 0) {
      setNote(t('pkgNothingToFetch', { name }))
      return
    }
    setBusy({ name, done: 0, total: plan.length })
    for (const [index, target] of plan.entries()) {
      const outcome = await cachePackage(target)
      if (!alive.current) return
      if (!outcome.ok) {
        setNote(t('pkgFetchFailed', { name: target, error: outcome.error }))
        setBusy(null)
        void refresh()
        return
      }
      setBusy({ name, done: index + 1, total: plan.length })
    }
    setBusy(null)
    setNote(t('pkgFetched', { count: plan.length }))
    if (clearInput) setManual('')
    await refresh()
  }

  /** 清掉某个包的本机缓存：它下次被用到会重新取一次。 */
  const clearOne = async (name: string): Promise<void> => {
    if (busy !== null) return
    setNote(null)
    setBusy({ name, done: 0, total: 1 })
    try {
      await clearPackage(name)
      if (!alive.current) return
      setNote(t('pkgCleared', { name }))
    } catch (error) {
      console.error(`[manim-renderer] 清理 ${name} 失败：`, error)
      if (alive.current) setNote(t('pkgClearFailed', { name, error: error instanceof Error ? error.message : String(error) }))
    }
    if (!alive.current) return
    setBusy(null)
    await refresh()
  }

  return (
    <div className="mr-set-card">
      <div className="mr-set-head">
        <h2 className="mr-set-title">{t('pkgTitle')}</h2>
        <span className="mr-set-meta">{t('pkgCounts', { cached: counts.cached, bundled: counts.bundled, bytes: formatBytes(counts.bytes) })}</span>
        <Tip label={t('pkgRefreshHint')} align="end">
          <button type="button" className="mr-iconbtn mr-iconbtn-xs" disabled={busy !== null}
            aria-label={t('pkgRefresh')} onClick={() => { void refresh() }}>
            <RefreshCw size={13} />
          </button>
        </Tip>
      </div>

      {inventory !== null && (
        <div className="mr-set-path">
          <span className="mr-set-pathlabel">{t('pkgDir')}</span>
          {/* 路径被截断时靠原生 title 给全文（这里给的是数据不是说明文案，且旁边的复制键能拿走完整路径） */}
          <code className="mr-set-codepath" title={inventory.cacheDir}>{inventory.cacheDir}</code>
          <Tip label={copied ? t('pkgDirCopied') : t('pkgDirCopy')} align="end">
            <button type="button" className="mr-iconbtn mr-iconbtn-xs" aria-label={t('pkgDirCopy')}
              onClick={() => copy(inventory.cacheDir)}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </Tip>
        </div>
      )}

      {failure !== null && <p className="mr-set-error" role="status">{t('pkgFailed', { message: failure })}</p>}

      {failure === null && inventory === null && <p className="mr-set-empty" role="status">{t('loading')}</p>}

      {inventory !== null && (
        <>
          <div className="mr-set-list">
            {shown.map((entry) => (
              <div key={entry.name} className="mr-set-row" data-kind="pkg" data-tone={packageTone(entry.state)}>
                <Dot tone={packageTone(entry.state)} />
                <span className="mr-set-name">{entry.name}</span>
                <span className="mr-set-ver">{entry.version}</span>
                <Tag tone={packageTagTone(entry.state)}>{t(stateKey(entry.state))}</Tag>
                <span className="mr-set-size">{entry.bytes === null ? '—' : formatBytes(entry.bytes)}</span>
                <span className="mr-set-act">
                  {entry.state === 'absent' && (
                    <Tip label={t('pkgCacheHint')} align="end">
                      <button type="button" className="mr-btn" disabled={busy !== null}
                        onClick={() => { void fetchPackages(entry.name) }}>
                        {busy !== null && busy.name === entry.name && busy.total > 1
                          ? t('pkgFetching', { done: busy.done, total: busy.total })
                          : t('pkgCache')}
                      </button>
                    </Tip>
                  )}
                  {entry.state === 'cached' && (
                    <Tip label={t('pkgClearHint')} align="end">
                      <button type="button" className="mr-btn" disabled={busy !== null}
                        onClick={() => { void clearOne(entry.name) }}>
                        {t('pkgClear')}
                      </button>
                    </Tip>
                  )}
                </span>
              </div>
            ))}
          </div>

          <form className="mr-set-tools" onSubmit={(event) => { event.preventDefault(); void fetchPackages(manual.trim(), true) }}>
            <Tip label={t('pkgManualHint')} align="start">
              <label className="mr-set-field">
                <input className="mr-set-fieldinput" type="text" value={manual} spellCheck={false}
                  placeholder={t('pkgManual')} aria-label={t('pkgManualLabel')}
                  onChange={(event) => setManual(event.target.value)} />
              </label>
            </Tip>
            <button type="submit" className="mr-btn primary" disabled={busy !== null || manual.trim().length === 0}>
              {t('pkgCache')}
            </button>
          </form>

          <p className="mr-set-hint">{t('pkgListHint')}</p>
        </>
      )}

      {note !== null && <p className="mr-set-note" role="status">{note}</p>}
    </div>
  )
}

/** 设置页正文：两块卡片，样式与留白由外层设置面板给（这里只管内容）。 */
export function ManimSettingsPage({ t }: { t: Translate }) {
  return (
    <section className="mr-set" aria-label={t('nav')}>
      <EnvCard t={t} />
      <PackagesCard t={t} />
    </section>
  )
}
