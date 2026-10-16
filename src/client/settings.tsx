// 设置页：浏览器运行时 + Python 库（第三方库按需缓存）。
//
// 两块都在回答同一个问题——「要真的用起来，这台机器还缺什么」：上面一块是**渲染**的浏览器侧条件
// （运行时、公式样式、WebGL、WebAssembly、逐帧导出），下面一块是渲染时要用到的第三方库。
//
// **本机那一侧（Manim / FFmpeg / LaTeX 探测）已从界面上撤掉**：它服务的是「用本机 manim CLI
// 渲 mp4」那条导出路，而那条路与卡片不同引擎、语义有实测分歧（见 ../export.ts 的文件头），
// 所以本插件只在浏览器里导出。本机的 Host 路由（`/environment`、`/export`）与探测代码都还在，
// 要恢复就把这张卡接回来。
//
// **页面只留数据与控件，解释一律收进 ⓘ**（悬浮/键盘聚焦才出现）：每行是「名字 + ⓘ + 状态点与取值」；
// 库清单每行是「状态点 + 名字 + 大小 + 一个文字键」（缓存 / 删除 / 内置）——图标要人猜，文字不用。
// 状态点在最前面，眼睛先看到「在不在」。
//
// 版式是「外面一个小分组标签 + 若干张自带头部的卡片」：标题、一行说明与动作键都在卡片头部里
// （照宿主「存储」「审计中心」页），间距由卡片内边距撑起来。要往清单里补别的库，走底下那张
// 「下载其他库」卡片——头部标题 + 一行短说明，输入框与按钮在卡片身体里。
//
// 取数一律**逐项来**（下载一个库一个请求），所以界面是逐行亮起来的，中途失败只影响那一行；
// 同时只允许一个下载任务在跑（下载是重活，别叠着来）。
//
// 样式只用宿主 `--dsw-alias-*` token（明暗双主题自动成立），类名统一 `mr-` 前缀。
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
// ⓘ 图标取名 InfoIcon：本文件自己的 Info 组件（说明的收口）占了这个名字。
import { Info as InfoIcon, RefreshCw } from 'lucide-react'
import { Dot } from './components/dot'
import { Tip } from './components/tip'
// 状态点的语义、色调映射与取词表都在 ./runtime-status。
import { capabilityTone, KATEX_PHRASE, katexTone, RUNTIME_PHRASE, runtimeTone, useEnvironmentStatus, type StatusTone as Tone } from './runtime-status'
import {
  cachePackage, clearPackage, COMMON_PACKAGES, completionFor, findPackage, formatBytes, loadPackages, prefetchPlan,
  type PackageEntry, type PackageInventory, type PackageState,
} from './packages'
import type { Translate } from './i18n'

/** 库的三态：已缓存在本机=绿实心；随包自带=灰实心（在，但不归这里管）；还没缓存=空心环。 */
const pkgTone = (state: PackageState): Tone => (state === 'cached' ? 'ok' : state === 'bundled' ? 'idle' : 'empty')

/** 状态点的读屏名（点的颜色与虚实是给眼睛看的，读屏得有一句话；内置那个词与键上的一致）。 */
const pkgStateKey = (state: PackageState): string =>
  (state === 'cached' ? 'pkgStateCached' : state === 'bundled' ? 'pkgBundled' : 'pkgStateAbsent')

/**
 * 浏览器运行时卡片：数据全在核心包的环境状态里（订阅 `onEnvironmentStatus`），不走 Host 路由——
 * 这些事发生在浏览器里，Host 问不到。
 */
function RuntimeCard({ t }: { t: Translate }) {
  const status = useEnvironmentStatus()
  const rows = [
    {
      id: 'runtime',
      tone: runtimeTone(status.runtime.phase),
      label: t('rtRuntime'),
      value: t(RUNTIME_PHRASE[status.runtime.phase]),
      info:
        status.runtime.error ??
        (status.runtime.indexURL === null ? t('rtNoLoader') : t('rtIndexWhy', { url: status.runtime.indexURL })),
    },
    {
      id: 'katex',
      tone: katexTone(status.katex.phase),
      label: t('rtKatex'),
      value: t(KATEX_PHRASE[status.katex.phase]),
      info: status.katex.error ?? (status.katex.baseURL === null ? t('rtKatexWhy') : t('rtKatexAt', { url: status.katex.baseURL })),
    },
    { id: 'webgl', tone: capabilityTone(status.capabilities.webgl), label: t('rtWebgl'), value: t(status.capabilities.webgl ? 'rtYes' : 'rtNo'), info: t('rtWebglWhy') },
    { id: 'wasm', tone: capabilityTone(status.capabilities.wasm), label: t('rtWasm'), value: t(status.capabilities.wasm ? 'rtYes' : 'rtNo'), info: t('rtWasmWhy') },
    { id: 'recorder', tone: capabilityTone(status.capabilities.videoExport), label: t('rtRecorder'), value: t(status.capabilities.videoExport ? 'rtYes' : 'rtNo'), info: t('rtRecorderWhy') },
  ]
  const subline = status.hints.length > 0 ? t('rtHints', { count: status.hints.length }) : t('rtAllReady')
  return (
    <section className="mr-set-card">
      <header className="mr-set-cardhead">
        <div className="mr-set-cardheadtext">
          <h3 className="mr-set-cardtitle">{t('rtTitle')}</h3>
          <p className={status.hints.length > 0 ? 'mr-set-cardsub is-error' : 'mr-set-cardsub'} role="status">{subline}</p>
        </div>
      </header>
      <div className="mr-set-rows">
        {rows.map((row) => (
          <div key={row.id} className="mr-set-row">
            <span className="mr-set-cell is-check">
              <span className="mr-set-name">{row.label}</span>
              <Info name={row.label} text={row.info} />
            </span>
            <span className="mr-set-cell is-status">
              <Dot tone={row.tone} />
              <span>{row.value}</span>
            </span>
          </div>
        ))}
      </div>
      {/* hints 是核心包给的可执行句（缺能力 / 运行时或 KaTeX 加载失败 / 取包失败），原样摆出来 */}
      {status.hints.length > 0 && <p className="mr-set-cardfoot is-error" role="status">{status.hints.join('\n')}</p>}
    </section>
  )
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
 * Python 库：**两张卡片**——上面一张是「已缓存的库」清单（头部右上是刷新），
 * 下面一张是「缓存其他库」（头部标题 + 一行短说明，输入框与按钮在卡片身体里）。
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
      console.error('[manim-card] 取包清单失败：', error)
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
      console.error(`[manim-card] 清理 ${name} 失败：`, error)
      if (alive.current) setNote(t('pkgClearFailed', { name, error: error instanceof Error ? error.message : String(error) }))
    }
    if (!alive.current) return
    setBusy(null)
    await refresh()
  }

  return (
    <section className="mr-set-group" aria-label={t('pkgTitle')}>
      <h2 className="mr-set-groupname">{t('pkgTitle')}</h2>
      <div className="mr-set-stack">
        <section className="mr-set-card">
          {/* 头部只放标题（+ 计数）与刷新：存放路径不在页面上摆（它是实现细节，
              要知道在哪儿看 README 就够了），读取出错才在卡片脚注里说一句 */}
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
            </div>
            <div className="mr-set-cardacts">
              <Tip label={t('pkgRefreshHint')} align="end">
                <button type="button" className="mr-set-act" disabled={busy !== null} onClick={() => { void refresh() }}>
                  <RefreshCw size={14} />
                  {t('pkgRefresh')}
                </button>
              </Tip>
            </div>
          </header>

          {/* 库行 = 状态点 + 名字 + 大小 + 一个有话直说的文字键：没缓存的给「缓存」、
              已缓存的给「删除」、随包自带的「内置」（禁用键，形状与位置跟旁边那列齐） */}
          {inventory !== null && (
            <div className="mr-set-rows is-light">
              {shown.map((entry) => (
                <div key={entry.name} className="mr-set-row">
                  {/* 点在最前面报状态（绿=已缓存 / 灰=内置 / 空心=还没缓存），
                      名字单独一段好截断，后面才是那个键 */}
                  <span className="mr-set-cell is-name">
                    <Dot tone={pkgTone(entry.state)} label={t(pkgStateKey(entry.state))} />
                    <span className="mr-set-name">{entry.name}</span>
                  </span>
                  {/* 大小这一列：不在本机（还没缓存的）没得报——给个破折号。
                      不能显示 0 B，那看着像「占了 0 字节」 */}
                  <span className="mr-set-cell is-size">
                    {entry.bytes === null ? '—' : formatBytes(entry.bytes)}
                  </span>
                  <span className="mr-set-cell is-act">
                    {/* 自带的那几个：用同一个键、只置灰禁用——右列才跟「缓存 / 删除」对齐
                        （文字标签会各宽各的，整个右列就散了） */}
                    {entry.state === 'bundled' && (
                      <button type="button" className="mr-set-act is-sm" disabled>{t('pkgBundled')}</button>
                    )}
                    {entry.state === 'cached' && (
                      <Tip label={t('pkgClearHint')} align="end">
                        <button type="button" className="mr-set-act is-sm" disabled={busy !== null}
                          onClick={() => { void clearOne(entry.name) }}>
                          {t('pkgClear')}
                        </button>
                      </Tip>
                    )}
                    {entry.state === 'absent' && (
                      <Tip label={t('pkgCacheHint')} align="end">
                        <button type="button" className="mr-set-act is-sm" disabled={busy !== null}
                          onClick={() => { void fetchPackages(entry.name) }}>
                          {t('pkgCache')}
                        </button>
                      </Tip>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {failure !== null && (
            <p className="mr-set-cardfoot is-error" role="status">{t('pkgFailed', { message: failure })}</p>
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

/** 设置页正文：环境组一张卡（浏览器运行时），库组一张卡加一张补库卡。 */
export function ManimSettingsPage({ t }: { t: Translate }) {
  return (
    <section className="mr-set" aria-label={t('sectionTitle')}>
      <section className="mr-set-group" aria-label={t('envGroup')}>
        <h2 className="mr-set-groupname">{t('envGroup')}</h2>
        <div className="mr-set-stack">
          <RuntimeCard t={t} />
        </div>
      </section>
      <PackagesCard t={t} />
    </section>
  )
}
