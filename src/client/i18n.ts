/**
 * 本插件可见文案。宿主 locale 只维护中文（英文缺失时回退行为以实测为准），
 * 取词走 ctx.locale.bind(NS)，组件从 props 收 t。
 *
 * 页面上的**说明性长文案一律做成悬浮提示**（键名带 `Hint`）——页面本身只留控件，
 * 开发自己知道在干什么，不需要每次都被念一遍。
 */
export const NS = 'manimRenderer'

/** 宿主 locale.bind 返回的取词函数（宿主返回值未带类型，按用法声明）。 */
export type Translate = (key: string, params?: Record<string, string | number>) => string

export const DICT = {
  zh: {
    nav: 'Manim 渲染',
    title: 'Manim 渲染',
    lead: '实验场：一批标准 Manim 写法，点一条当场渲染。跑的是与聊天卡片完全相同的渲染路径——这里复现不出问题的代码，卡片里也不会有问题。语料不在插件包里，是开发机上的回归网（插件仓 _dev/ 下）；正式安装里这一页只剩「自定义代码」。',

    modeLabel: '视图',
    modeGround: '语料实验场',
    modeFree: '自定义代码',

    groundCountIdle: '尚未跑过',
    groundCount: '{passed} / {total} 通过 · {failed} 失败',
    groundHint: '左边点一条渲染一条，或用工具条的「全部渲染」按顺序跑。结果标在条目左侧（绿=符合预期、红=未通过）；「复制结果」会把每条的文件路径与报错一起带走。语料是插件仓 _dev/ 下的完整 Manim 文件，一个文件一条、独立可跑——不随插件发布。',
    netBadge: '需联网',
    corpusLoading: '正在读取语料…',
    corpusDevOnly: '这台机器上没有语料——它是开发期的回归网，放在插件仓 _dev/examples/（不随插件发布），所以实验场只在开发机可用。下面是「自定义代码」，照样能提交并渲染 Manim Python。',
    corpusError: '读取语料失败：{message}',
    clearCache: '清除已下载的库',
    clearCacheHint: '把本机已经下载的第三方库删掉。想再看一次「首次下载」的过程、或让某个库重新联网下载时用它；已经加载进当前页面的库要刷新页面才会卸掉。',
    cacheCleared: '已删掉 {count} 个库',
    cacheClearFailed: '清除失败：{message}',

    renderAll: '全部渲染',
    renderAllHint: '依次渲染尚未通过的语料（已通过的跳过）。批量一律走极速——不等 run_time 与 wait，否则一套上百条要几分钟。中途点「停止」会停下，进度已经存下来了。',
    stopAll: '停止',
    stopAllHint: '停下这一轮渲染',
    copyReport: '复制结果',
    copyReportHint: '复制成一份回执：每条的文件路径、结果、报错与源码',
    copyReportDone: '已复制',
    copyReportEmpty: '还没有结果',
    clearRecord: '清除记录',
    clearRecordHint: '清掉已保存的渲染结果与自定义代码，下次从头开始',

    fastOn: '极速渲染',
    fastHint: '极速：不等 run_time 与 wait，直接落到终态。跑全套语料用；看动画过程请关掉。updater 驱动的轨迹仍会被推进，不会变成空的。',

    runGroup: '渲染本组',
    runGroupHint: '按顺序渲染这一组里尚未通过的语料（走极速，不等动画）',

    expectLabel: '预期',
    expectHint: '这条语料应该看到什么。自动结果只说明「没炸」；画得对不对，要对着这句话看。',
    // ---- 上次截图（语料条目旁边那张图）----
    // 只在本机开发仓里有（`_dev/shots/`，Host 只在文件真在时才给 shot 字段），正式安装里不出现。
    shotLabel: '上次截图',
    shotHint:
      '这条语料上一次真渲染出来的画面，由 scripts/shot-corpus.mjs 落盘、与语料同名存放在 _dev/shots/ 下。自动结果只说「没炸」、预期只说「应该长什么样」，中间那一步——画面到底对不对——看这张图；重跑截图脚本会覆盖同名文件，所以这里永远是当前这版。点开可看原尺寸（1280×720）。',
    markTitle: '人工验证',
    markHint: '看完动画手动标一下对不对。标注单独保存（刷新还在），可用旁边的橡皮擦单独清除，不影响自动渲染结果。',
    markPass: '对',
    markFail: '不对',
    markUnmark: '清除本条标注',
    markNone: '未标',
    marksClear: '清除人工标注',
    marksClearHint: '清掉全部人工验证标注（自动渲染结果不动）',
    marksCount: '人工 ✓{passed} ✗{failed}',

    collapseGroup: '收起分组',
    expandGroup: '展开分组',

    reportTitle: '# manim-renderer 实验场结果',
    reportTime: '时间：{time}',
    reportSummary: '总计 {total} 条 · 已跑 {tried} · 通过 {passed} · 失败 {failed}',
    reportFailed: '## 失败（{count}）',
    reportPassed: '## 通过（{count}）',
    reportUntried: '## 未跑（{count}）',
    reportCase: '[{id}] {title} — {file} · 期望 {expect}',
    reportError: '错误：{text}',
    reportSource: '源码：',
    reportEmpty: '（还没有跑过任何语料）',

    previewTitle: '预览',
    previewHint: '与聊天卡片同一个组件：右上角可重新播放、查看代码；代码框右上角可一键复制。',
    previewEmpty: '从左边的语料里点一条，或切到「自定义代码」写一段——结果出现在这里。',

    sourceTitle: '自定义代码',
    sourceHint: '优先写完整的 Manim Python 文件（from manim import * + class X(Scene): def construct(self): …）；只写 construct 体也收。标准 Python 3 语法都可用。',
    freeLabel: '自定义代码',
    render: '渲染',
    renderHint: '渲染这段代码（内容会自动保存，下次进来还在）',
    rendering: '渲染中…',
    timeout: '渲染超时（60 秒没有返回）',
    stopped: '已停止',
    ok: '渲染完成',
    fail: '渲染失败',
    loadingPackages: '正在加载 {names}…',
    loadingPackagesHint:
      '这段代码用到了需要额外下载的库（{names}），正在下载。首次用到需要联网，下载后存在本机、之后断网也能用；下一次就不用等了。',

    cardLabel: 'Manim 动画',
    // 顶栏那个播放键的两种状态共用一个位置：没在播 = ▶ 手动播放；正在播 = ⏩ 直接落终态。
    // 不用「重播」这个词——它暗示「必须播过才谈得上再播」，而中断过的卡一次都没播过。
    manualPlay: '手动播放',
    skipToEnd: '不演了，直接跳到终态',
    showCode: '查看代码',
    hideCode: '收起代码',
    copy: '复制代码',
    copied: '已复制',
    badCard: '卡片数据不完整（缺少 python 源码）',
    rejected: '代码未通过预检，未渲染',
    interrupted: '这次工具调用被中断了',
    interruptedHint:
      '这次 manim_render 没跑完就被宿主收尾了（常见于回合被停止），所以卡片不替你自动渲染——代码本身是完整的，想看就点播放。',

    // ---- 卡片：导出视频（本机 manim CLI 真渲染成 mp4，存「下载」文件夹）----
    // 按钮亮不亮由环境必要条件决定（Python / manim / manim 库 / FFmpeg）；灰着的时候悬停要说清缺什么。
    exportVideo: '导出视频',
    exportReadyHint: '用本机安装的 Manim 渲染成 mp4（1080p），存到「下载」文件夹。',
    exportChecking: '正在检查本机环境，稍等…',
    exportMissingHint: '暂时不能导出，本机还缺：{missing}。到 设置 → Manim 渲染 里查看详情。',
    exportUnknownHint: '本机环境暂时检查不了，不能导出。',
    exportBusy: '正在用本机 Manim 渲染并导出…要真跑一遍，可能得等一会儿',
    exportDone: '已导出到 {path}',
    exportFailed: '导出失败：{error}',
    revealHint: '在文件夹中显示',
    revealFailed: '打不开文件夹：{error}',
    exportGone: '上次导出的文件已经不在了（可能被移走或删掉）：{path}',

    // ---- 设置页：本机环境 ----
    // 探测项的标题与「为什么看它」按 id 查（见 settings.tsx 的 ENV_COPY）；
    // 这些命令都读本机 —— 桥里的 Pyodide 是 WebAssembly，跟本机的 Manim 完全是两套东西。
    // 分组标签（只在卡片外面用来分组）与卡片标题分开：外面是「环境」，卡片里才是「本机环境」
    envGroup: '环境',
    envTitle: '本机环境',
    envReady: '{ready} / {total} 就绪',
    envRerun: '重新检测',
    envRerunHint: '再检查一遍。其中 Manim 那一项比较慢（要把它本身跑起来），可能要十几秒。',
    envProbing: '正在检测…',
    envPlanFailed: '拿不到检测计划：{message}',
    envMissing: '未安装',
    envError: '出错',
    envFoundAt: '找到的位置：{path}',
    envRan: '实际跑的命令：{command}',
    envPython3: 'Python 3',
    envPython3Why: 'Manim 是 Python 写的；导出时要拿你电脑上的 Python 去跑它。',
    envManim: 'Manim CLI',
    envManimWhy: 'manim 这个命令本身能不能跑 —— 本机渲染与导出的入口。',
    envManimModule: 'manim 库',
    envManimModuleWhy: 'manim 命令所用的那个 Python 里，到底装没装 manim 库。命令能用、库里没有——这种情况真的存在（比如命令是软链到某个 venv 的），所以跟上面一项分开看；探测会跟着 manim 命令找到它真正的解释器。',
    envFfmpeg: 'FFmpeg',
    envFfmpegWhy: 'Manim 出视频（mp4 / gif）要靠它；缺了只能出一张张静态图片。',
    envLatex: 'LaTeX',
    envLatexWhy: 'MathTex / Tex 用它排版公式；缺了这些写法会直接报错。',
    envDvisvgm: 'dvisvgm',
    envDvisvgmWhy: 'LaTeX 转 SVG 的那一步 —— Manim 渲染公式的第二半。',

    // ---- 设置页：Python 库（第三方库按需缓存） ----
    // 分组标签用 pkgTitle；卡片标题另有其名（pkgCardTitle / pkgAddTitle）
    // 用词一律「缓存」不用「下载」：这些包本来就是运行时联网取的，这里做的是「提前存到本机」，
    // 说「缓存」跟「之后断网也能用」是同一件事。
    pkgTitle: 'Python 库',
    pkgCardTitle: '已缓存的库',
    pkgCountsShort: '{cached} 个 · {bytes}',
    pkgRefresh: '刷新',
    pkgRefreshHint: '再看一次：哪些库已经在本机、各占多大。',
    pkgBundled: '内置',
    // 库行前面那个状态点的读屏名（内置那档复用 pkgBundled）
    pkgStateCached: '已缓存',
    pkgStateAbsent: '未缓存',
    pkgFailed: '读不到库列表：{message}',
    pkgCache: '缓存',
    pkgCacheHint: '缓存在本机（会把它用到的其他库一起缓存），之后断网也能用。',
    pkgFetchingNote: '正在缓存 {name}…（{done}/{total}）',
    pkgFetched: '已缓存 {count} 个库',
    pkgFetchFailed: '缓存 {name} 失败：{error}',
    pkgNothingToFetch: '{name} 已经在本机了',
    pkgUnknown: '找不到这个库：{name}',
    pkgClear: '删除',
    pkgClearHint: '从本机删掉它（下次用到会重新联网缓存一次）。自带的几个不占这份空间，不受影响。',
    pkgCleared: '已删除 {name}',
    pkgClearFailed: '删除 {name} 失败：{error}',
    pkgAddTitle: '缓存其他库',
    pkgAddHint: '写上库的名字就行；输入时会有提示，按 Tab 或 → 采纳。',
    pkgManual: '库名，如 pandas',
    pkgManualLabel: '库名',
  },
}
