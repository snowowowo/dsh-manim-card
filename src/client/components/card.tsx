// 聊天卡片：AI 写出 Manim Python → 卡片进入视口自动渲染，离开视口即释放画布。
// 聊天流是虚拟滚动的（滚出即卸载、滚回即重挂），把画布生命周期绑到视口上，
// WebGL 上下文就只覆盖"当前可见的那几张卡"，不会随历史卡片累积。
import { useEffect, useRef, useState } from 'react'
import { Copy, CodeXml, Download, RotateCcw } from 'lucide-react'
import { createSurface, type Surface } from '../engine/renderer'
import type { ManimCardData } from '../definition'
import type { Translate } from '../i18n'
import { loadExportReadiness, requestExport, type ExportReadiness } from '../export'
import { useCopied } from '../clipboard'
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
  const [copiedPath, copyPath] = useCopied()
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

  const doExport = (): void => {
    if (exporting || !ready) return
    setExporting(true)
    setExportNote(null)
    requestExport(data.python)
      .then((result) => {
        if (result.ok) {
          setExportNote({ ok: true, text: t('exportDone', { path: result.file }), path: result.file })
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
    return <div className="mr-chatcard"><span className="mr-status err">{t('badCard')}</span></div>
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
          <span className="mr-status err" role="status">{t('rejected')}</span>
          {toggleCode}
        </div>
        {showCode && <div className="mr-chatcard-code"><CodeView code={data.python} t={t} /></div>}
        <p className="mr-chatcard-error">{data.feedback?.error ?? t('fail')}</p>
      </div>
    )
  }

  // 取包的进展盖在画布正中（见下面的浮层），顶部栏只留 ok / fail：
  // 跟在标签后面的那行字，标签一长就被挤没，而且长在边框上沿、视线本来也不在那儿。
  const loadingNames = loading === null ? null : loading.join('、')
  const takingPackages = slowLoading && loadingNames !== null
  const statusText = status === null ? '' : status.ok ? t('ok') : t('fail')
  const statusClass = status === null ? 'mr-status' : status.ok ? 'mr-status ok' : 'mr-status err'

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

  return (
    <div className="mr-chatcard">
      <div className="mr-chatcard-head">
        <span className="mr-chatcard-label">{label ?? t('cardLabel')}</span>
        <span className={statusClass} role="status">
          {statusText}
        </span>
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
      {/* 完整报错放画布下方：顶部栏只留短状态，高度才守得住。 */}
      {status !== null && !status.ok && <p className="mr-chatcard-error">{status.text}</p>}
      {/* 导出回执与报错同理：路径可能很长，截断展示，悬停能看全，旁边一键复制。 */}
      {exportNote !== null && (exportNote.ok ? (
        <p className="mr-chatcard-export">
          <span className="mr-chatcard-exporttext" title={exportNote.text}>{exportNote.text}</span>
          {exportNote.path !== undefined && (
            <Tip label={copiedPath ? t('copied') : t('copyPath')} align="end">
              <button
                className="mr-iconbtn"
                type="button"
                aria-label={t('copyPath')}
                onClick={() => copyPath(exportNote.path ?? '')}
              >
                <Copy size={14} strokeWidth={1.6} />
              </button>
            </Tip>
          )}
        </p>
      ) : (
        <p className="mr-chatcard-error">{exportNote.text}</p>
      ))}
    </div>
  )
}