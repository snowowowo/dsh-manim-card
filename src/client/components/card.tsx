// 聊天卡片：AI 写出 Manim Python → 卡片挂着不拆，由渲染调度器（render-queue.ts）决定
// 「什么时候轮到它跑」「按什么顺序跑」「画布攒到几张该收」。
//
// 两条曾经的误解都会直接变成事故，写在这儿免得再踩：
//
//   1) 「聊天流是虚拟滚动的、滚出即卸载」——**是错的**。宿主的 `ChatNodeList` 是
//      `entries.map(...)` 全量渲染，宿主文档也写着 "The transcript itself remains fully
//      mounted"（被虚拟化的是右侧那条 Turn 导航条，不是正文）。行一直是挂着的，
//      所以「拆画布」从头到尾都是我们自己干的。
//   2) 于是「滚出视口就 dispose」纯属自伤：滚回来要重跑一遍 Python，屏幕上先空一块、
//      再重画——用户看到的就是「一滚动它就又播一遍」。现在**滚出视口不拆**，
//      画布只在两种情况下没：卡片真卸载，或调度器按上限淘汰（超编时收离阅读位置最远的）。
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, CircleX, CodeXml, Download, FastForward, Play, TriangleAlert } from 'lucide-react'
import type { Surface } from 'manim-live'
import type { ManimCardData } from '../definition'
import type { Translate } from '../i18n'
import { manimRenderer } from '../service'
import { loadExportReadiness, requestExport, revealExport, type ExportReadiness } from '../export'
import { missingLabels, renderBlockHints } from '../runtime-status'
import { loadExports, rememberExport } from '../storage'
import { renderQueue } from '../render-queue'
import { CodeView } from './code-view'
import { Tip } from './tip'

export interface CardResult {
  ok: boolean
  text: string
}

/**
 * 底部状态栏的一行：图标 + 内容。
 *
 * 为什么状态都收在底部：顶栏是「这张卡是什么」——标签与动作键，高度要稳；
 * 而「现在怎么样了」是随时在变的一层，长在顶栏会把标签挤掉、还让视线往上跑。
 * 于是**顶栏只留标签与按钮**，渲染成功不吭声（画面本身就是回执），
 * 只有出错、以及导出这条用户主动发起的事，才在底部出一条。
 *
 * warn 是给「这次调用被中断」那类：不是代码错，但也不该当作什么都没发生。
 */
function FootRow({ tone, role, className, children }: { tone: 'ok' | 'error' | 'busy' | 'warn'; role?: 'status' | 'alert'; className?: string; children: ReactNode }) {
  const icon = tone === 'busy'
    ? <span className="mr-spinner" aria-hidden="true" />
    : tone === 'ok'
      ? <CircleCheck size={14} strokeWidth={1.8} aria-hidden="true" />
      : tone === 'warn'
        ? <TriangleAlert size={14} strokeWidth={1.8} aria-hidden="true" />
        : <CircleX size={14} strokeWidth={1.8} aria-hidden="true" />
  return (
    <div className={className === undefined ? `mr-chatcard-footrow is-${tone}` : `mr-chatcard-footrow is-${tone} ${className}`} role={role}>
      {icon}
      {children}
    </div>
  )
}

/**
 * 「这张卡在本页的自动播机会已经用掉了」。
 *
 * 为什么是模块级的：卡片滚出视口会被调度器淘汰画布、回来要重跑，组件里的状态活不过那一趟；
 * 而这条账要跨挂载——不然回来又是一条好汉、从头再播一遍。
 *
 * 为什么只记在内存、不落 localStorage：这是「这一页看过没有」。刷新之后画布本来就没了，
 * 重来一次自然重算（也符合直觉）；落盘反而会让这张卡在之后的每一天都永远是静默的。
 */
const spent = new Set<string>()

/**
 * 这一趟该「放动画」还是「直接落末帧」——整条播放规则就这一个函数。
 *
 * 自动那趟值得放的条件：**这张卡是刚生成出来的（`live`）、这一页还没放过它、而且它是本批的代表**。
 * 其余一律落末帧——重挂、滚回来、以及打开老会话时回填的整屏卡：
 * 老会话里几十张卡各播一遍，谁也等不起，而且那些画面用户早就看过了。
 *
 * 两个用户动作**压过全部自动规则**：
 * - 手动播放 → 一定真播。包括那张「预算已经用掉」的、老会话的、以及实验场极速档下的——
 *   点下去就是「我要看这一段」。它**同样压过「本批只由代表播」**：那条是跨卡的省算力规则，
 *   拿它把用户按下的键按回去，等于按了个寂寞（非代表那张按下去只会跳到终态）。
 * - ⏩ 跳过 → 不演，直接落终态。
 *
 * `batchTail`（本批是不是由它代表真播）不在这里判：那是**跨卡**的事（同一个 step 里谁最后到），
 * 由调度器判好了传进来，见 render-queue 的 `isBatchTail`。
 *
 * 抽成纯函数是为了能被单测钉住：这是产品规则，不该埋在 effect 里靠跑界面验证。
 */
export function decidePlay(input: {
  live: boolean
  spent: boolean
  manual: boolean
  fast: boolean
  /** 用户按了 ⏩：不演了，直接到最终态。 */
  skip: boolean
  /** 这一批（同一个 step）里由它代表真播。 */
  batchTail: boolean
}): boolean {
  if (input.skip) return false
  if (input.manual) return true
  if (input.fast) return false
  if (input.spent) return false
  return input.live && input.batchTail
}

/**
 * 渲染卡片。聊天流与实验场页面**共用这一个组件**——页面不再自己维护画布，
 * 于是「重播 / 查看代码 / 复制」这些能力天然一致，不会再各改各的。
 *
 * - `label`  顶栏标签，缺省是聊天场景的「Manim 动画」（实验场传样例标题）。
 * - `onResult` 一次渲染结束的回调（成功失败都调），实验场用它把结果显示到样例条目上。
 * - `autoStart` 不理会视口、挂载即渲染。聊天流靠 IntersectionObserver 保证「只有可见的那几张
 *   在跑」，但实验场一次只有一张卡、而它可能被滚出可视区（右侧栏往下翻看代码），
 *   那时再等视口就会把页面吊在半路——所以那一侧显式关掉视口门控。
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
  /**
   * 渲染失败时环境那边的硬伤（核心包给的可执行句）。空数组 = 失败与环境无关（多半是代码问题）。
   * 与状态一起被清掉，所以重跑一次就重新判一次。
   */
  const [envHints, setEnvHints] = useState<string[]>([])
  const [showCode, setShowCode] = useState(false)
  /** 画布上已经有一幅画好的终态画面了（跑完那一刻置位；被作废 / 被淘汰时清零）。 */
  const [rendered, setRendered] = useState(false)
  /** 这一趟是真播（用户在看着动画演）。决定「要不要盖骨架屏」与按钮显示哪个图标。 */
  const [playing, setPlaying] = useState(false)
  // 按需取包的进展：只在这段代码用到了随包之外的库时才有值，且延迟 300ms 才显示——
  // 随包件（numpy / sympy）与磁盘缓存命中都是瞬时的事，闪一下提示反而像卡住了。
  const [loading, setLoading] = useState<string[] | null>(null)
  const [slowLoading, setSlowLoading] = useState(false)
  const loadingActive = loading !== null
  /**
   * 「让渲染 effect 重跑一次」的计数。
   *
   * 只有一种情况需要它：**被中断的卡**——那种卡第一次根本不会渲染（effect 直接 return），
   * 于是没有画布、`controls` 也是空的，用户点「手动播放」时够不到任何东西，只能靠这个计数
   * 把 effect 重新叫起来。其余情况一律**原地重跑**（effect 里的 `rerun`），不回炉重注册：
   * 重注册会和上一趟迟到的 `release()` 撞在一起，把新登记的那份误标成「有画布了」。
   */
  const [attempts, setAttempts] = useState(0)
  /** 按钮下一次触发的模式（手动播放 / ⏩ 跳过）。effect 读一次就清回 auto。 */
  const modeRef = useRef<'auto' | 'manual' | 'skip'>('auto')
  /** 渲染 effect 把「原地重跑」递出来给按钮用（闭包变量 JSX 够不到）。 */
  const controls = useRef<{ rerun: (mode: 'manual' | 'skip') => void } | null>(null)
  // 导出视频：就绪结论（null = 还在检查）、导出中、导出回执。就绪结论问的是 Host（带缓存），
  // 几十张卡各问一遍也不会各跑一遍探测。
  const [readiness, setReadiness] = useState<ExportReadiness | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState<{ ok: boolean; text: string; path?: string } | null>(null)
  const empty = data.python.trim().length === 0
  // Host 已先预检过一遍：ok:false 表示代码没过预检，卡片只显示错误、不再起画布重跑。
  const rejected = data.feedback !== undefined && !data.feedback.ok
  // 这次工具调用被宿主中断了（回执不是我们那套 JSON，而是「这次没跑成」的收尾文案）：
  // 那张卡照样在、代码照样能看，但**不自动渲染**——那一轮用户不要了，没必要替他烧算力。
  // 中断消息通常在卡片开始播之后几秒才到（宿主预检跑了一半被打断），届时这条会把它收掉：
  // 画布拆掉、回到「未渲染 + 说明」——宁可停得干脆，也不要留一块在跑的空白。
  const interrupted = data.interrupted === true
  // 回调走 ref：调用方每次渲染都会给新函数，进依赖数组会把渲染 effect 反复重启。
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  /** 状态既落在卡片上，也回给调用方（实验场用它点亮语料条目的红绿点）。 */
  const report = (next: CardResult): void => {
    // 失败时顺手看一眼环境：有硬伤（起不了解释器 / 没有 WebGL / 取包失败）就把话摆出来。
    // 一次失败只取一次——不订阅环境状态，几十张卡各挂一个订阅不划算，而失败那一刻的读数就够用了。
    setEnvHints(next.ok ? [] : renderBlockHints())
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
        console.error('[manim-live] export readiness failed:', error)
        if (alive) setReadiness({ ready: false, missing: [] })
      })
    return () => {
      alive = false
    }
  }, [])

  // 上次导出过什么：卡片会随切会话 / 刷新页面被卸载重挂（滚出视口不再拆了，见 top 注），
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
        console.error('[manim-live] export record check failed:', error)
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
            ? missingLabels(result.missing ?? [], t)
            : result.error ?? t('fail')
          setExportNote({ ok: false, text: t('exportFailed', { error }) })
        }
      })
      .catch((error) => {
        console.error('[manim-live] export failed:', error)
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
        console.error('[manim-live] reveal failed:', error)
        setExportNote({ ok: false, text: t('revealFailed', { error: error instanceof Error ? error.message : String(error) }) })
      })
  }

  useEffect(() => {
    const stage = stageRef.current
    if (stage === null || empty || rejected) return
    // 被中断的调用不自动渲染：那一轮用户不要了，没必要替他烧算力。
    // 想在中断之后自己看，按「手动播放」——那一下会把 attempts 从 0 顶到 1，这条 effect 重跑，
    // 于是走到下面去（不再是「直接 return」这一支）。
    if (data.interrupted === true && attempts === 0) return

    let alive = true
    let surface: Surface | null = null
    /**
     * 这一趟怎么跑：自动（按规则抽签）、手动（用户点了播放，一定真播）、
     * 跳过（用户按了 ⏩，不演了、直接落终态）。
     *
     * 放在闭包里而不是 state：它只在**发车那一刻**被读一次，进 state 只会多一轮渲染。
     * 按钮那侧改 `modeRef` 再叫本组件原地重跑，见 rerun。
     */
    let mode: 'auto' | 'manual' | 'skip' = modeRef.current
    modeRef.current = 'auto'
    /**
     * 这一趟的编号。`rerun` / 淘汰 / 卸载都会把它顶掉——在途的那些 `await` 醒来看一眼编号，
     * 不是自己那一趟就直接收摊。没有它的话，「按 ⏩ 打断正在建的画布」会让两个 run 抢同一块舞台。
     */
    let generation = 0

    /** 这一次该不该真播——判据全在 decidePlay 里（含「手动压过一切」那两条），这里只负责取数。 */
    const shouldPlay = (): boolean => decidePlay({
      live: data.live === true,
      spent: spent.has(data.callId),
      manual: mode === 'manual',
      skip: mode === 'skip',
      fast: fast === true,
      batchTail: renderQueue.isBatchTail(data.callId),
    })

    /** 把这一趟作废并把画布收掉。两个出口：调度器淘汰、用户按 ⏩ / 手动播放打断。
     *  （卡片卸载不在这里——组件都要没了，setState 没有意义，cleanup 里自己收更干脆。） */
    const dropSurface = (): void => {
      generation += 1
      surface?.dispose()
      surface = null
      setRendered(false)
      setPlaying(false)
      setLoading(null)
    }

    /**
     * 轮到这张卡了（调度器发的许可）。**跑完必须 release**，否则整条队列停在这儿。
     *
     * `release` 要如实报「跑完时手里还有没有画布」——被 ⏩ / 手动播放打断的那趟画布已经收了，
     * 报 `true` 会让这张卡被当成「已经有画布」而永远不再排队（台上留一块空白加骨架屏）。
     */
    const run = (release: (hasCanvas: boolean) => void): void => {
      const mine = generation
      const play = shouldPlay()
      // **决定即记账**：这一次机会用掉了，之后不再重新抽签。
      //
      // 曾经这里有个「作废就把机会还回去」的例外，而那正是「滚出屏幕、等下再回来又从头演一遍」
      // 的成因：全页一条队列，滚出去时这一趟多半还排着队 → 作废 → 机会退回 → 回来重演。
      // 用户口径早就定了：**播到一半被打断也算它播过了，不补**。
      if (play) spent.add(data.callId)
      setPlaying(play)
      setRendered(false)

      void (async () => {
        try {
          // 极速与否只看**这一趟要不要演**：不演的那趟（自动落末帧、⏩ 跳过）直接落终态；
          // 要演的那趟一律真演——哪怕实验场的极速开关还开着，手动播放点下去就是要看过程。
          // 画布工厂在核心包里（`manim-live`），本插件只持有那个页面级单例渲染器（见 ../service.ts）。
          const created = await manimRenderer().createSurface(stage, { fast: !play })
          // 建的过程中这一趟被作废了（按了 ⏩、被淘汰、卡片卸载）：当场释放，别泄漏上下文。
          if (!alive || mine !== generation) {
            created.dispose()
            return
          }
          surface = created
          const result = await created.run(data.python, {
            onLoading: (names) => {
              if (alive && mine === generation) setLoading(names.length === 0 ? null : names)
            },
          })
          if (!alive || mine !== generation) return
          // cancelled = 轮到它之前画布就被拆了。这不是「渲染失败」，一个字都不该报出去，
          // 但**也不退还机会**（理由见上面记账那行）。
          if (result.cancelled === true) return
          setRendered(true)
          report(result.ok ? { ok: true, text: t('ok') } : { ok: false, text: result.error ?? t('fail') })
        } catch (error) {
          console.error('[manim-live] card render failed:', error)
          if (alive && mine === generation) {
            report({ ok: false, text: error instanceof Error ? error.message : String(error) })
          }
        } finally {
          if (alive && mine === generation) {
            setLoading(null)
            setPlaying(false)
          }
          // 如实报「手里还有没有画布」：被打断的那趟已经收掉了，报 false 才会重新排队。
          release(alive && mine === generation && surface !== null)
        }
      })()
    }

    renderQueue.register(
      { callId: data.callId, seq: data.seq, stepKey: data.stepKey },
      // 实验场一次只挂一张卡、而它可能被滚出可视区（右侧栏往下翻看代码），那时再等视口
      // 就会把页面吊在半路——所以那一侧直接报「可见」，不摆观察者。
      { visible: autoStart === true, willing: true, hasCanvas: false },
      { run, evict: dropSurface },
    )

    /**
     * 原地再跑一趟（手动播放 / ⏩ 跳过）。
     *
     * **不回炉重注册**：重注册会把 `visible` 覆盖成传进去的那个值——聊天那一侧传的是
     * `autoStart === true`，也就是 false，这张卡于是丢掉真实可见性，要等下一次
     * IntersectionObserver 回调才回来；顺带还会把这一批的静默期重新计时。
     * 只把 `hasCanvas` 报回 false，调度器自然把它重新排进队。
     */
    const rerun = (next: 'manual' | 'skip'): void => {
      mode = next
      setStatus(null)
      dropSurface()
      renderQueue.update(data.callId, { hasCanvas: false })
    }
    // 按钮长在 JSX 里，够不到上面的闭包，从这里递出去。
    controls.current = { rerun }

    const observer = new IntersectionObserver(
      (entries) => {
        // 只**报**可见性，不再决定生死——拆不拆画布是调度器按上限说了算（滚出视口不拆）。
        renderQueue.update(data.callId, { visible: entries.some((entry) => entry.isIntersecting) })
      },
      { rootMargin: '240px' }, // 提前一屏登记「可见」，滚到时不至于白等
    )
    observer.observe(stage)

    return () => {
      alive = false
      observer.disconnect()
      controls.current = null
      renderQueue.unregister(data.callId)
      // 卸载这里不走 dropSurface：组件都要没了，setState 没有意义。
      generation += 1
      surface?.dispose()
      surface = null
    }
  }, [data.python, data.callId, data.seq, data.stepKey, data.interrupted, empty, rejected, attempts, t, autoStart, fast])

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
        ? t('exportMissingHint', { missing: missingLabels(readiness.missing, t) })
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
  // 导出是用户主动发起的长活儿，从进行中到成功/失败全程有回执；被中断的调用常驻一条说明。
  // 三者都在时上下几行。
  const renderFailed = status !== null && !status.ok
  const hasFoot = renderFailed || interrupted || exporting || exportNote !== null

  // 被中断的卡在「还没手动播过」之前连画布都不摆——一块空边框看着像渲染坏了，
  // 跟未通过预检那张卡一个形状（头 + 说明）反而更清楚。
  const showStage = !interrupted || attempts > 0
  // 骨架屏：想渲染、还没画好、而且**不是在真播**（真播时用户就是要看过程，别盖住）。
  // 它同时盖住两种时刻：排队等许可，以及极速重跑的那一段——后者会把一串中间态频闪出来
  //（极速只是把动画时长压到 0，每个 play 仍然各画一帧），只有盖住才只剩「骨架 → 终态」。
  const skeleton = showStage && !rendered && !playing

  /**
   * 播放键。两种状态共用一个键：
   * - 没在播 → **手动播放**：一定真播一遍（跟自动那套规则无关）。
   * - 正在播 → **⏩**：不演了，直接落终态。
   */
  const onPlayButton = (): void => {
    const next = playing ? 'skip' : 'manual'
    // 被中断的卡先前压根没渲染（effect 直接 return 了），得先把那条 effect 叫起来。
    if (interrupted && attempts === 0) {
      modeRef.current = next
      setAttempts(1)
      return
    }
    controls.current?.rerun(next)
  }

  return (
    <div className="mr-chatcard">
      <div className="mr-chatcard-head">
        <span className="mr-chatcard-label">{label ?? t('cardLabel')}</span>
        <span className="mr-chatcard-spacer" />
        <button
          className="mr-iconbtn"
          type="button"
          aria-label={playing ? t('skipToEnd') : t('manualPlay')}
          title={playing ? t('skipToEnd') : t('manualPlay')}
          onClick={onPlayButton}
        >
          {playing
            ? <FastForward size={15} strokeWidth={1.6} />
            : <Play size={15} strokeWidth={1.6} />}
        </button>
        {toggleCode}
        {exportButton}
      </div>
      {/* 画布与代码同一块位置：切的是视图，不是把代码挤进内容里。画布保持挂载，
          切回来接着看，不必重跑一遍 Pyodide。
          滚出视口**不拆**——拆不拆由调度器按画布上限说了算（见 render-queue.ts）。 */}
      <div className="mr-chatcard-body">
        {showStage && <div className="mr-stage" ref={stageRef} />}
        {showCode && <div className="mr-code-pane"><CodeView code={data.python} t={t} /></div>}
        {/* 骨架屏：块状、不带文字。**不能写字**——这会儿是「动画在跑」，不是「在下载什么」，
            写「正在加载」会跟取包那条撞车（那条才是真的在取东西）。 */}
        {skeleton && !showCode && (
          <div className="mr-canvas-skeleton" aria-hidden="true">
            <span className="mr-skel mr-skel-circle" />
            <span className="mr-skel mr-skel-square" />
            <span className="mr-skel mr-skel-triangle" />
          </div>
        )}
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
      {/* 底部状态栏：渲染失败、被中断的调用、导出进行中/成功/失败，都长在这一条上 */}
      {hasFoot && (
        <div className="mr-chatcard-foot">
          {renderFailed && <FootRow tone="error" role="alert">{status.text}</FootRow>}
          {/* 失败与环境有关时补一条：错在代码还是错在机器，用户要能当场分开——
              否则「渲染失败」这四个字只会把人引去改代码，而缺的是 WebGL 或那 13 MB 的运行时常量。 */}
          {renderFailed && envHints.length > 0 && (
            <FootRow tone="warn" role="status" className="is-envhint">
              <div className="mr-chatcard-envhint">
                <span>{t('renderEnvBlocked')}</span>
                <ul className="mr-chatcard-envlist">
                  {envHints.map((hint) => <li key={hint}>{hint}</li>)}
                </ul>
              </div>
            </FootRow>
          )}
          {interrupted && (
            <FootRow tone="warn" role="status">
              <Tip label={t('interruptedHint')} align="start" wide>{t('interrupted')}</Tip>
            </FootRow>
          )}
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