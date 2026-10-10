// 设置页：本机环境 + Python 库（第三方库按需下载）。
//
// 两件事放一页，因为它们回答的是同一个问题——「要真的用起来，这台机器还缺什么」：
// 上面一块是本机装的 Manim / FFmpeg / LaTeX（**导出**要走它们，桥里的运行时没有这些），
// 下面一块是渲染时要用到的第三方库。
//
// **页面只留数据与控件，解释一律收进 ⓘ**（悬浮/键盘聚焦才出现）：环境那几项是重要项，
// 每行名字后面跟一个 ⓘ；库清单只有名字与一个动作图标——能下载的给下载键、能删的给删除键，
// 状态不用文字再描述一遍。
//
// 版式是「外面一个小分组标签 + 若干张自带头部的卡片」：标题、一行说明与动作键都在卡片头部里
// （照宿主「存储」「审计中心」页），间距由卡片内边距撑起来。要往清单里补别的库，走底下那张
// 「下载其他库」卡片——头部标题 + 一行短说明，输入框与按钮在卡片身体里。
//
// 取数一律**逐项来**（环境一项一个请求、下载一个库一个请求），所以界面是逐行亮起来的，
// 中途失败只影响那一行；同时只允许一个下载任务在跑（下载是重活，别叠着来）。
//
// 样式只用宿主 `--dsw-alias-*` token（明暗双主题自动成立），类名统一 `mr-` 前缀。
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
// ⓘ 图标取名 InfoIcon：本文件自己的 Info 组件（说明的收口）占了这个名字。
import { Check, Copy, Download, Info as InfoIcon, RefreshCw, Trash2 } from 'lucide-react'
import { Tip } from './components/tip'
import { useCopied } from './clipboard'
import { loadEnvPlan, probeEnv, type EnvCheck, type EnvPlan, type EnvResult, type EnvStatus } from './environment'
import {
  cachePackage, clearPackage, COMMON_PACKAGES, completionFor, findPackage, formatBytes, loadPackages, prefetchPlan,
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
 * 头部左侧报「几项就绪」（正在检测 / 拿不到计划时换成当时的状态），右上是「重新检测」。
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
  // 头部那一行说明：常态报「几项就绪」，正在检测 / 拿不到计划时换成当时的状态——
  // 位置固定，所以卡片不会因为这句来去而忽高忽低。
  const subline = failure !== null
    ? t('envPlanFailed', { message: failure })
    : plan === null ? t('envProbing') : t('envReady', { ready, total })

  return (
    <section className="mr-set-group" aria-label={t('envTitle')}>
      <h2 className="mr-set-groupname">{t('envGroup')}</h2>
      <div className="mr-set-stack">
        <section className="mr-set-card">
          <header className="mr-set-cardhead">
            <div className="mr-set-cardheadtext">
              <h3 className="mr-set-cardtitle">{t('envTitle')}</h3>
              <p className={failure !== null ? 'mr-set-cardsub is-error' : 'mr-set-cardsub'}
                title={failure !== null ? subline : undefined} role="status">
                {subline}
              </p>
            </div>
            <div className="mr-set-cardacts">
              <Tip label={t('envRerunHint')} align="end">
                <button type="button" className="mr-set-act" disabled={running} onClick={() => { void load() }}>
                  <RefreshCw size={14} />
                  {t('envRerun')}
                </button>
              </Tip>
            </div>
          </header>

          {plan !== null && (
            <div className="mr-set-rows">
              {plan.checks.map((check) => {
                const result = results[check.id]
                const tone: Tone = result === undefined ? 'busy' : envTone(result.status)
                return (
                  <div key={check.id} className="mr-set-row">
                    <span className="mr-set-cell is-check">
                      <span>{t(envTitleKey(check.id))}</span>
                      <Info name={t(envTitleKey(check.id))} text={envInfo(t, check, result)} />
                    </span>
                    <span className="mr-set-cell is-status">
                      <Dot tone={tone} />
                      {result !== undefined && <span>{envValue(t, result)}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

/**
 * 环境项的 ⓘ：为什么看这项、找到了哪儿、实际跑的什么——页面上只留「名字 + 状态」，
 * 这些解释性内容全部收在这里，悬浮/键盘聚焦才出现。
 */
function envInfo(t: Translate, check: EnvCheck, result: EnvResult | undefined): string {
  const lines = [t(envWhyKey(check.id))]
  if (result === undefined) lines.push(t('envProbing'))
  else if (result.status === 'ok') lines.push(t('envFoundAt', { path: result.path ?? '' }))
  else lines.push(result.detail.length > 0 ? result.detail : t('envMissing'))
  lines.push(t('envRan', { command: check.command }))
  return lines.join('\n')
}

/** ⓘ 图标：说明的收口。可聚焦（聚焦即出说明），点了没有动作——它只是个「看解释」的入口。 */
function Info({ name, text }: { name: string; text: string }) {
  return (
    <Tip label={text} align="start" wide>
      <button type="button" className="mr-set-info" aria-label={`${name}：${text}`}>
        <InfoIcon size={13} />
      </button>
    </Tip>
  )
}

// ---------------------------------------------------------------- 包缓存

/**
 * Python 库：**两张卡片**——上面一张是「已缓存的库」清单（头部右上是复制路径与刷新），
 * 下面一张是「下载其他库」（头部标题 + 一行短说明，输入框与按钮在卡片身体里）。
 *
 * 清单为什么不是全表：lock 里有近三百条，绝大多数人一辈子用不到——把常用的摆出来，
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
  const [composing, setComposing] = useState(false)
  const [extra, setExtra] = useState<string[]>([])
  const [busy, setBusy] = useState<{ name: string; done: number; total: number } | null>(null)
  // 两处动作各报各的：清单行上的动作报在清单卡片的脚注，补库卡片里的动作报在补库卡片的脚注——
  // 回执就出现在动手的地方，不用跑到别处找。
  const [note, setNote] = useState<string | null>(null)
  const [formNote, setFormNote] = useState<string | null>(null)
  const [copied, copy] = useCopied()
  const alive = useRef(true)
  const manualId = useId()

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

  /**
   * 输入框的补全虚影（按名字前缀）。
   *
   * 两个「不显示」的判断：
   *  - 中文输入法组字期间不显示——组字中的字还没定型，虚影会跟着跳；
   *  - 「已输入 + 要补的」整段太长时不显示：虚影是按输入框里的字往后接的，
   *    一旦输入框内部滚动就对不上了。40 是照输入框实际宽度（内容列 564px 减去按钮，
   *    13px 字号）能稳稳放下的字数取的——宁可长名字不给虚影，也不能给一截错位的。
   */
  const ghost = useMemo(() => {
    if (composing || manual.length === 0) return null
    const completion = completionFor(entries, manual)
    if (completion === null || manual.length + completion.suffix.length > 40) return null
    return completion
  }, [composing, entries, manual])

  /** Tab / → 采纳虚影。只在真有虚影、且光标在末尾时接管，其余情况让默认行为照常走。 */
  const acceptGhost = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (ghost === null) return
    if (event.key !== 'Tab' && event.key !== 'ArrowRight') return
    // 光标在中间时 Tab 该去下一格、→ 该移光标，别在这儿把人截住
    if (event.currentTarget.selectionStart !== manual.length) return
    event.preventDefault()
    setManual(ghost.name)
  }

  /** 把它摆到表上（手输过的包留在表里，便于回头清理）。 */
  const surface = (name: string): void => {
    setExtra((previous) => (previous.includes(name) ? previous : [...previous, name]))
  }

  /**
   * 取一个包（连依赖）：先算闭包，再一个一个取，进度落在按钮上。
   * 名字不认识 / 已经在本机都当场说清楚，不去发无谓的请求。
   *
   * `fromForm` 只决定回执报在哪张卡片的脚注（补库卡片 vs 清单卡片），不改变取法。
   */
  const fetchPackages = async (name: string, fromForm = false): Promise<void> => {
    const say = fromForm ? setFormNote : setNote
    if (name.length === 0 || busy !== null) return
    say(null)
    if (findPackage(entries, name) === undefined) {
      say(t('pkgUnknown', { name }))
      return
    }
    surface(name)
    const plan = prefetchPlan(entries, name)
    if (plan.length === 0) {
      say(t('pkgNothingToFetch', { name }))
      return
    }
    setBusy({ name, done: 0, total: plan.length })
    for (const [index, target] of plan.entries()) {
      const outcome = await cachePackage(target)
      if (!alive.current) return
      if (!outcome.ok) {
        say(t('pkgFetchFailed', { name: target, error: outcome.error }))
        setBusy(null)
        void refresh()
        return
      }
      // 动作列只剩图标，进度就落到卡片脚注那行小字上（图标上只有悬浮提示）
      setBusy({ name, done: index + 1, total: plan.length })
      say(t('pkgFetchingNote', { name, done: index + 1, total: plan.length }))
    }
    setBusy(null)
    say(t('pkgFetched', { count: plan.length }))
    if (fromForm) setManual('')
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

  // 清单卡片的头部说明：读不到清单就报错、还在读就报进度、读到了就把存放路径摆出来
  // （路径是数据不是说明，放这儿比单独一行省地方；旁边的「复制路径」能拿走全文）
  const subline = failure !== null
    ? <p className="mr-set-cardsub is-error" title={t('pkgFailed', { message: failure })} role="status">{t('pkgFailed', { message: failure })}</p>
    : inventory === null
      ? <p className="mr-set-cardsub" role="status">{t('loading')}</p>
      : <p className="mr-set-cardsub is-path" title={inventory.cacheDir}>{inventory.cacheDir}</p>

  return (
    <section className="mr-set-group" aria-label={t('pkgTitle')}>
      <h2 className="mr-set-groupname">{t('pkgTitle')}</h2>
      <div className="mr-set-stack">
        <section className="mr-set-card">
          <header className="mr-set-cardhead">
            <div className="mr-set-cardheadtext">
              <h3 className="mr-set-cardtitle">
                {t('pkgCardTitle')}
                {inventory !== null && (
                  <span className="mr-set-cardcount">
                    {t('pkgCountsShort', { cached: counts.cached, bytes: formatBytes(counts.bytes) })}
                  </span>
                )}
              </h3>
              {subline}
            </div>
            <div className="mr-set-cardacts">
              <button type="button" className="mr-set-act" disabled={inventory === null}
                onClick={() => { if (inventory !== null) copy(inventory.cacheDir) }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? t('pkgDirCopied') : t('pkgDirCopy')}
              </button>
              <Tip label={t('pkgRefreshHint')} align="end">
                <button type="button" className="mr-set-act" disabled={busy !== null} onClick={() => { void refresh() }}>
                  <RefreshCw size={14} />
                  {t('pkgRefresh')}
                </button>
              </Tip>
            </div>
          </header>

          {/* 库行只有名字与一个动作图标：能下载的给下载键、能删的给删除键，
              随包自带的没有动作（不用下、也删不掉）——状态不用文字再描述一遍。 */}
          {inventory !== null && (
            <div className="mr-set-rows is-light">
              {shown.map((entry) => {
                const working = busy !== null && busy.name === entry.name
                return (
                  <div key={entry.name} className="mr-set-row">
                    <span className="mr-set-cell is-name">{entry.name}</span>
                    <span className="mr-set-cell is-act">
                      {entry.state === 'absent' && (
                        <Tip label={working ? t('pkgFetching', { done: busy.done, total: busy.total }) : t('pkgCacheHint')} align="end">
                          <button type="button" className="mr-iconbtn" disabled={busy !== null}
                            aria-label={t('pkgCache')} onClick={() => { void fetchPackages(entry.name) }}>
                            {working ? <Dot tone="busy" /> : <Download size={15} />}
                          </button>
                        </Tip>
                      )}
                      {entry.state === 'cached' && (
                        <Tip label={working ? t('pkgClearing', { name: entry.name }) : t('pkgClearHint')} align="end">
                          <button type="button" className="mr-iconbtn" disabled={busy !== null}
                            aria-label={t('pkgClear')} onClick={() => { void clearOne(entry.name) }}>
                            {working ? <Dot tone="busy" /> : <Trash2 size={15} />}
                          </button>
                        </Tip>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {note !== null && <p className="mr-set-cardfoot" role="status">{note}</p>}
        </section>

        {/* 补库也是一张卡片：头部给标题与一行短说明，输入框与按钮进卡片身体 */}
        <section className="mr-set-card">
          <header className="mr-set-cardhead">
            <div className="mr-set-cardheadtext">
              <h3 className="mr-set-cardtitle">{t('pkgAddTitle')}</h3>
              <p className="mr-set-cardsub">{t('pkgAddHint')}</p>
            </div>
          </header>

          <form className="mr-set-addrow" onSubmit={(event) => { event.preventDefault(); void fetchPackages(manual.trim(), true) }}>
            {/* 补全虚影：镜像层在输入框底下，前半段不可见、后半段是淡字——
                看着就像光标后面接着一段灰字。键盘焦点与取值都在 input 上。 */}
            <span className="mr-set-field">
              {ghost !== null && (
                <span className="mr-set-mirror" aria-hidden="true">
                  <span className="mr-set-typed">{manual}</span>
                  <span className="mr-set-ghost">{ghost.suffix}</span>
                </span>
              )}
              <input id={manualId} className="mr-set-fieldinput" type="text" value={manual} spellCheck={false}
                placeholder={t('pkgManual')} aria-label={t('pkgManualLabel')}
                autoComplete="off" autoCapitalize="off" autoCorrect="off"
                onChange={(event) => setManual(event.target.value)}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={() => setComposing(false)}
                onKeyDown={acceptGhost} />
            </span>
            <button type="submit" className="mr-btn primary tall" disabled={busy !== null || manual.trim().length === 0}>
              {t('pkgCache')}
            </button>
          </form>

          {formNote !== null && <p className="mr-set-cardfoot" role="status">{formNote}</p>}
        </section>
      </div>
    </section>
  )
}

/** 设置页正文：两块内容，样式与留白由外层设置面板给（这里只管内容）。 */
export function ManimSettingsPage({ t }: { t: Translate }) {
  return (
    <section className="mr-set" aria-label={t('nav')}>
      <EnvCard t={t} />
      <PackagesCard t={t} />
    </section>
  )
}
