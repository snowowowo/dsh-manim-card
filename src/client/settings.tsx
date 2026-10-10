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
import { Check, Copy, RefreshCw, Search } from 'lucide-react'
import { Tip } from './components/tip'
import { Segmented } from './components/segmented'
import { useCopied } from './clipboard'
import { loadEnvPlan, probeEnv, type EnvCheck, type EnvPlan, type EnvResult, type EnvStatus } from './environment'
import {
  cachePackage, formatBytes, loadPackages, prefetchPlan, stateKey,
  type PackageEntry, type PackageInventory, type PackageState,
} from './packages'
import type { Translate } from './i18n'

/** 列表一次最多画多少行：全表近三百条，画全了白卡；剩下的靠搜索缩小范围。 */
const MAX_ROWS = 60

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

type Filter = 'local' | 'absent' | 'all'

/**
 * 包缓存卡片：清单 + 预缓存。
 *
 * 默认只列「本地已有」（随包 + 已取回）——那正是用户想知道的事；
 * 想提前取什么就切到「未缓存」找。取的时候连依赖一起取（见 packages.ts 的 prefetchPlan），
 * 取完**重新问一次 Host**要状态，而不是本地猜（状态以后端为准）。
 */
function PackagesCard({ t }: { t: Translate }) {
  const [inventory, setInventory] = useState<PackageInventory | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('local')
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
  const counts = useMemo(() => {
    let bundled = 0
    let cached = 0
    let absent = 0
    let bytes = 0
    for (const entry of entries) {
      if (entry.state === 'bundled') bundled += 1
      else if (entry.state === 'cached') { cached += 1; bytes += entry.bytes ?? 0 }
      else absent += 1
    }
    return { bundled, cached, absent, bytes }
  }, [entries])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = (entry: PackageEntry): boolean => {
      if (filter === 'local' && entry.state === 'absent') return false
      if (filter === 'absent' && entry.state !== 'absent') return false
      if (needle.length === 0) return true
      return entry.name.toLowerCase().includes(needle)
        || entry.imports.some((name) => name.toLowerCase().includes(needle))
    }
    return entries.filter(matches)
  }, [entries, filter, query])

  const shown = filtered.slice(0, MAX_ROWS)

  /** 取一个包：先算出依赖闭包，再一个一个取（进度落在按钮上）。 */
  const prefetch = async (entry: PackageEntry): Promise<void> => {
    if (busy !== null) return
    setNote(null)
    const plan = prefetchPlan(entries, entry.name)
    if (plan.length === 0) {
      setNote(t('pkgNothingToFetch', { name: entry.name }))
      return
    }
    setBusy({ name: entry.name, done: 0, total: plan.length })
    for (const [index, name] of plan.entries()) {
      const outcome = await cachePackage(name)
      if (!alive.current) return
      if (!outcome.ok) {
        setNote(t('pkgFetchFailed', { name, error: outcome.error }))
        setBusy(null)
        void refresh()
        return
      }
      setBusy({ name: entry.name, done: index + 1, total: plan.length })
    }
    setBusy(null)
    setNote(t('pkgFetched', { count: plan.length }))
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
          <div className="mr-set-tools">
            <Segmented label={t('pkgFilter')} value={filter} disabled={busy !== null}
              options={[
                { value: 'local', label: t('pkgFilterLocal') },
                { value: 'absent', label: t('pkgFilterAbsent') },
                { value: 'all', label: t('pkgFilterAll') },
              ]}
              onChange={(next) => setFilter(next)} />
            <label className="mr-set-search">
              <Search size={13} aria-hidden="true" />
              <input className="mr-set-searchinput" type="search" value={query} spellCheck={false}
                placeholder={t('pkgSearch')} aria-label={t('pkgSearch')}
                onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>

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
                        onClick={() => { void prefetch(entry) }}>
                        {busy !== null && busy.name === entry.name
                          ? t('pkgFetching', { done: busy.done, total: busy.total })
                          : t('pkgCache')}
                      </button>
                    </Tip>
                  )}
                </span>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="mr-set-empty" role="status">
              {filter === 'local' ? t('pkgEmptyLocal') : query.length > 0 ? t('pkgEmptySearch', { query }) : t('pkgEmptyAbsent')}
            </p>
          )}
          {filtered.length > shown.length && (
            <p className="mr-set-more">{t('pkgMore', { count: filtered.length - shown.length })}</p>
          )}
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
