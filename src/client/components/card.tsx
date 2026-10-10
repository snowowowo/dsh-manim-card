// 聊天卡片：AI 写出 Manim Python → 卡片进入视口自动渲染，离开视口即释放画布。
// 聊天流是虚拟滚动的（滚出即卸载、滚回即重挂），把画布生命周期绑到视口上，
// WebGL 上下文就只覆盖"当前可见的那几张卡"，不会随历史卡片累积。
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, CircleX, CodeXml, Download, RotateCcw } from 'lucide-react'
import { createSurface, type Surface } from '../engine/renderer'
import type { ManimCardData } from '../definition'
import type { Translate } from '../i18n'
import { loadExportReadiness, requestExport, revealExport, type ExportReadiness } from '../export'
import { loadExports, rememberExport } from '../storage'
import { CodeView } from './code-view'
import { Tip } from './tip'

export interface CardResult {
  ok: boolean
  text: string
}

/** 探测项 id → 设置页同款可读名：悬停提示里「缺什么」要让人看得懂，不能甩 id。 */
function missingNames(missing: ExportReadiness['missing'], t: Translate): string {
  const NAMES: Record<string, string> = {
    python3: t('envPython3'),
    manim: t('envManim'),
    manimModule: t('envManimModule'),
    ffmpeg: t('envFfmpeg'),
    latex: t('envLatex'),
    dvisvgm: t('envDvisvgm'),
  }
  return missing.map((item) => NAMES[item.id] ?? item.id).join('、')
}

/**
 * 底部状态栏的一行：图标 + 内容。
 *
 * 为什么状态都收在底部：顶栏是「这张卡是什么」——标签与动作键，高度要稳；
 * 而「现在怎么样了」是随时在变的一层，长在顶栏会把标签挤掉、还让视线往上跑。
 * 于是**顶栏只留标签与按钮**，渲染成功不吭声（画面本身就是回执），
 * 只有出错、以及导出这条用户主动发起的事，才在底部出一条。
 */
function FootRow({ tone, role, children }: { tone: 'ok' | 'error' | 'busy'; role?: 'status' | 'alert'; children: ReactNode }) {
  const icon = tone === 'busy'
    ? <span className="mr-spinner" aria-hidden="true" />
    : tone === 'ok'
      ? <CircleCheck size={14} strokeWidth={1.8} aria-hidden="true" />
      : <CircleX size={14} strokeWidth={1.8} aria-hidden="true" />
  return (
    <div className={`mr-chatcard-footrow is-${tone}`} role={role}>
      {icon}
      {children}
    </div>
  )
}

/**
 * 渲染卡片。聊天流与实验场页面**共用这一个组件**——页面不再自己维护画布，
 * 于是「重播 / 查看代码 / 复制」这些能力天然一致，不会再各改各的。
 *
 * - `label`  顶栏标签，缺省是聊天场景的「Manim 动画」（实验场传语料标题）。
 * - `onResult` 一次渲染结束的回调（成功失败都调），实验场用它把结果显示到语料条目上。
 * - `autoStart` 不理会视口、挂载即渲染。聊天流靠 IntersectionObserver 保证「只有可见的那几张
 *   在跑」，但实验场一次只有一张卡、而它可能被滚出可视区（右侧栏往下翻看代码），
 *   那时再等视口就会让「全部渲染」卡住——所以那一侧显式关掉视口门控。
 * - `fast` 极速：不等 run_time / wait，直接落终态（实验场那个开关）。
 */
export function ManimCard({ data, t, label, onResult, autoStart, fast }: {
  data: ManimCardData
  t: Translate
  label?: string
  onResult?: (result: CardResult) => void
  autoStart?: boolean
  fast?: boolean
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<CardResult | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [busy, setBusy] = useState(false)
  // 按需取包的进展：只在这段代码用到了随包之外的库时才有值，且延迟 300ms 才显示——
  // 随包件（numpy / sympy）与磁盘缓存命中都是瞬时的事，闪一下提示反而像卡住了。
  const [loading, setLoading] = useState<string[] | null>(null)
  const [slowLoading, setSlowLoading] = useState(false)
  const loadingActive = loading !== null
  // 重播靠换 key 让下面的 effect 重跑：清理会拆掉旧画布，重建后 observer 立即回调重新播放。
  const [replayKey, setReplayKey] = useState(0)
  // 导出视频：就绪结论（null = 还在检查）、导出中、导出回执。就绪结论问的是 Host（带缓存），
  // 几十张卡各问一遍也不会各跑一遍探测。
  const [readiness, setReadiness] = useState<ExportReadiness | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState<{ ok: boolean; text: string; path?: string } | null>(null)
  const empty = data.python.trim().length === 0
  // Host 已先预检过一遍：ok:false 表示代码没过预检，卡片只显示错误、不再起画布重跑。
  const rejected = data.feedback !== undefined && !data.feedback.ok
  // 回调走 ref：调用方每次渲染都会给新函数，进依赖数组会把渲染 effect 反复重启。
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  /** 状态既落在卡片上，也回给调用方（实验场用它点亮语料条目的红绿点）。 */
  const report = (next: CardResult): void => {
    setStatus(next)
    onResultRef.current?.(next)
  }

  useEffect(() => {
    if (!loadingActive) {
      setSlowLoading(false)
      return
    }
    const timer = setTimeout(() => setSlowLoading(true), 300)
    return () => clearTimeout(timer)
  }, [loadingActive])

  // 就绪结论挂载即取：Host 有 TTL 缓存，这里不用协调「全页只取一次」。
  const ready = readiness?.ready === true
  useEffect(() => {
    let alive = true
    loadExportReadiness()
      .then((value) => {
        if (alive) setReadiness(value)
      })
      .catch((error) => {
        console.error('[manim-renderer] export readiness failed:', error)
        if (alive) setReadiness({ ready: false, missing: [] })
      })
    return () => {
      alive = false
    }
  }, [])

  // 上次导出过什么：卡片滚出视口就被卸载、滚回来是全新挂载（见 top 注），
  // 组件里的状态活不过那一趟——所以记录跟着 callId 落在 localStorage 里，挂载时捡回来。
  // 捡回来先只当「线索」：顺手问一下 Host 文件还在不在（不打开、不跑任何系统命令），
  // 不在了就把那条回执降级——拿一条早就失效的路径当真，比不显示更糟。
  useEffect(() => {
    const record = loadExports()[data.callId]
    if (record === undefined) return
    let alive = true
    setExportNote({ ok: true, text: t('exportDone', { path: record.file }), path: record.file })
    revealExport(record.file, { checkOnly: true })
      .then((result) => {
        if (!alive || result.ok || result.code !== 'missing') return
        setExportNote({ ok: false, text: t('exportGone', { path: record.file }) })
      })
      .catch((error) => {
        // 问不到（Host 没起来之类）就不动它：宁可留一条可能过期的线索，也别误报成「文件没了」
        console.error('[manim-renderer] export record check failed:', error)
      })
    return () => {
      alive = false
    }
  }, [data.callId, t])

  const doExport = (): void => {
    if (exporting || !ready) return
    setExporting(true)
    setExportNote(null)
    requestExport(data.python)
      .then((result) => {
        if (result.ok) {
          setExportNote({ ok: true, text: t('exportDone', { path: result.file }), path: result.file })
          rememberExport(data.callId, result.file)
        } else {
          const error = result.reason === 'environment'
            ? missingNames(result.missing ?? [], t)
            : result.error ?? t('fail')
          setExportNote({ ok: false, text: t('exportFailed', { error }) })
        }
      })
      .catch((error) => {
        console.error('[manim-renderer] export failed:', error)
        setExportNote({ ok: false, text: t('exportFailed', { error: error instanceof Error ? error.message : String(error) }) })
      })
      .finally(() => setExporting(false))
  }

  /** 在系统的文件浏览器里定位导出的文件（macOS：Finder 里选中它）。打不开就如实回一条错误。 */
  const showInFolder = (): void => {
    const file = exportNote?.path
    if (file === undefined) return
    revealExport(file)
      .then((result) => {
        if (result.ok) return
        setExportNote({
          ok: false,
          text: result.code === 'missing'
            ? t('exportGone', { path: file })
            : t('revealFailed', { error: result.error }),
        })
      })
      .catch((error) => {
        console.error('[manim-renderer] reveal failed:', error)
        setExportNote({ ok: false, text: t('revealFailed', { error: error instanceof Error ? error.message : String(error) }) })
      })
  }

  useEffect(() => {
    const stage = stageRef.current
    if (stage === null || empty || rejected) return

    let surface: Surface | null = null
    let visible = false
    let disposed = false

    const teardown = () => {
      surface?.dispose()
      surface = null
      setBusy(false)
      setLoading(null)
    }

    // 创建是异步的：等待期间可能已经滚出视口（visible 变 false）或卡片已卸载（disposed），
    // 两个出口都要把刚造出来的画布释放掉，否则上下文泄漏。
    const start = async (): Promise<void> => {
      if (disposed || surface !== null) return
      setBusy(true)
      try {
        const created = await createSurface(stage, { fast })
        if (disposed || !visible) {
          created.dispose()
          return
        }
        surface = created
        const result = await created.run(data.python, {
          onLoading: (names) => {
            if (!disposed) setLoading(names.length === 0 ? null : names)
          },
        })
        if (disposed) return
        report(result.ok ? { ok: true, text: t('ok') } : { ok: false, text: result.error ?? t('fail') })
      } catch (error) {
        console.error('[manim-renderer] card render failed:', error)
        if (!disposed) report({ ok: false, text: error instanceof Error ? error.message : String(error) })
      } finally {
        if (!disposed) {
          setBusy(false)
          setLoading(null)
        }
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting)
        if (visible) void start()
        else teardown()
      },
      { rootMargin: '240px' }, // 提前一屏创建，滚动到时不至于白等
    )
    if (autoStart === true) {
      visible = true
      void start()
    } else {
      observer.observe(stage)
    }

    return () => {
      disposed = true
      observer.disconnect()
      teardown()
    }
  }, [data.python, empty, rejected, replayKey, t, autoStart, fast])

  if (empty) {
    return (
      <div className="mr-chatcard">
        <div className="mr-chatcard-foot">
          <FootRow tone="error">{t('badCard')}</FootRow>
        </div>
      </div>
    )
  }

  const toggleCode = (
    <button
      className="mr-iconbtn"
      type="button"
      aria-label={showCode ? t('hideCode') : t('showCode')}
      aria-pressed={showCode}
      title={showCode ? t('hideCode') : t('showCode')}
      onClick={() => setShowCode((open) => !open)}
    >
      <CodeXml size={15} strokeWidth={1.6} />
    </button>
  )

  if (rejected) {
    return (
      <div className="mr-chatcard">
        <div className="mr-chatcard-head">
          <span className="mr-chatcard-label">{label ?? t('cardLabel')}</span>
          <span className="mr-chatcard-spacer" />
          {toggleCode}
        </div>
        {showCode && <div className="mr-chatcard-code"><CodeView code={data.python} t={t} /></div>}
        {/* 「未通过预检」这件事本身就是报错——按底栏的统一口径出：叉号 + 原话 */}
        <div className="mr-chatcard-foot">
          <FootRow tone="error" role="alert">{`${t('rejected')}：${data.feedback?.error ?? t('fail')}`}</FootRow>
        </div>
      </div>
    )
  }

  // 取包的进展盖在画布正中（见下面的浮层），顶栏不再放状态——状态统一收在底部（见 FootRow）。
  const loadingNames = loading === null ? null : loading.join('、')
  const takingPackages = slowLoading && loadingNames !== null

  // 导出按钮：亮不亮只看环境必要条件。灰着也要「说得出为什么」——悬停提示列缺什么；
  // 检查还没回来时同样灰着，提示「正在检查」。导出与画布互不相干（一条走本机 CLI，
  // 一条走 Pyodide），所以画布 busy 不拦导出。
  const exportTip = readiness === null
    ? t('exportChecking')
    : readiness.ready
      ? t('exportReadyHint')
      : readiness.missing.length > 0
        ? t('exportMissingHint', { missing: missingNames(readiness.missing, t) })
        : t('exportUnknownHint')
  const exportButton = (
    <Tip label={exportTip} align="end">
      <button
        className="mr-iconbtn"
        type="button"
        disabled={exporting || !ready}
        aria-label={t('exportVideo')}
        title={t('exportVideo')}
        onClick={doExport}
      >
        {exporting
          ? <span className="mr-spinner" aria-hidden="true" />
          : <Download size={15} strokeWidth={1.6} />}
      </button>
    </Tip>
  )

  // 底部状态栏的内容：渲染只在**失败**时出一条（成功不必吭声，画面本身就是回执）；
  // 导出是用户主动发起的长活儿，从进行中到成功/失败全程有回执。两者都在时上下两行。
  const renderFailed = status !== null && !status.ok
  const hasFoot = renderFailed || exporting || exportNote !== null

  return (
    <div className="mr-chatcard">
      <div className="mr-chatcard-head">
        <span className="mr-chatcard-label">{label ?? t('cardLabel')}</span>
        <span className="mr-chatcard-spacer" />
        <button
          className="mr-iconbtn"
          type="button"
          disabled={busy}
          aria-label={t('replay')}
          title={t('replay')}
          onClick={() => {
            setStatus(null)
            setReplayKey((n) => n + 1)
          }}
        >
          <RotateCcw size={15} strokeWidth={1.6} />
        </button>
        {toggleCode}
        {exportButton}
      </div>
      {/* 画布与代码同一块位置：切的是视图，不是把代码挤进内容里。画布保持挂载，
          切回来接着看，不必重跑一遍 Pyodide。 */}
      <div className="mr-chatcard-body">
        <div className="mr-stage" ref={stageRef} />
        {showCode && <div className="mr-code-pane"><CodeView code={data.python} t={t} /></div>}
        {/* 取包进度盖在画布正中：这会儿画布还是空的，视线本来就在中间；
            换成左下角只要改 .mr-canvas-loading 的对齐（见 styles.css）。 */}
        {takingPackages && loadingNames !== null && (
          <div className="mr-canvas-loading" role="status" title={t('loadingPackagesHint', { names: loadingNames })}>
            <span className="mr-canvas-loading-pill">
              <span className="mr-spinner" aria-hidden="true" />
              <span className="mr-canvas-loading-text">{t('loadingPackages', { names: loadingNames })}</span>
            </span>
          </div>
        )}
      </div>
      {/* 底部状态栏：渲染失败、导出进行中/成功/失败，都长在这一条上 */}
      {hasFoot && (
        <div className="mr-chatcard-foot">
          {renderFailed && <FootRow tone="error" role="alert">{status.text}</FootRow>}
          {exporting && <FootRow tone="busy" role="status">{t('exportBusy')}</FootRow>}
          {!exporting && exportNote !== null && (exportNote.ok && exportNote.path !== undefined ? (
            <FootRow tone="ok" role="status">
              {/* 路径本身就是唯一的入口：悬浮出气泡、点击在文件浏览器里选中它。
                  旁边不再放「复制 / 打开文件夹」两个键——那是同一个动作的第三、第四个说法，
                  悬停已经说清楚了。 */}
              <Tip label={t('revealHint')} align="start" className="mr-chatcard-pathwrap">
                <button
                  type="button"
                  className="mr-chatcard-path"
                  onClick={showInFolder}
                >
                  {exportNote.text}
                </button>
              </Tip>
            </FootRow>
          ) : (
            <FootRow tone="error" role="alert">{exportNote.text}</FootRow>
          ))}
        </div>
      )}
    </div>
  )
}