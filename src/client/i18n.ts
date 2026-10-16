/**
 * 本插件可见文案。宿主 locale 只维护中文（英文缺失时回退行为以实测为准），
 * 取词走 ctx.locale.bind(NS)，组件从 props 收 t。
 *
 * 页面上的**说明性长文案一律做成悬浮提示**（键名带 `Hint`）——页面本身只留控件，
 * 开发自己知道在干什么，不需要每次都被念一遍。
 */
export const NS = 'manimCard'

/** 宿主 locale.bind 返回的取词函数（宿主返回值未带类型，按用法声明）。 */
export type Translate = (key: string, params?: Record<string, string | number>) => string

export const DICT = {
  zh: {
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
      '这次 manim_card 没跑完就被宿主收尾了（常见于回合被停止），所以卡片不替你自动渲染——代码本身是完整的，想看就点播放。',

    // ---- 卡片：导出视频（在浏览器里逐帧编码，与卡片同一个渲染引擎，产物落「下载」）----
    // 灰着有两种原因，分开说：浏览器没这个能力（并说清缺哪一项）、或这一张还没画出来。
    exportVideo: '导出视频',
    exportReadyHint: '在浏览器里逐帧导出成一个视频文件——与卡片同一个渲染引擎，看到什么就导出什么；存到「下载」文件夹。',
    exportMissingHint: '当前浏览器不能导出视频：缺 {missing}。渲染不受影响。',
    exportPendingHint: '等这一张画出来就能导出。',
    exportBusy: '正在逐帧导出…',
    exportDone: '已导出 {name}，存在「下载」文件夹。',
    exportFailed: '导出失败：{error}',
    exportBroken: '这个版本里没有可用的导出器',

    // ---- 设置页：分组标签 ----
    // 分组标签只在卡片外面用来分组（卡片里各有自己的标题）。
    envGroup: '环境',

    // ---- 设置页：浏览器运行时 / 卡片的环境提示 ----
    // 这一侧说的是**渲染**的条件，全在浏览器里发生，Host 问不到，所以数据取自当前页面。
    // 词一律用日常说法：不出现 Pyodide、WASM 这类底层名词。
    rtTitle: '浏览器运行时',
    rtRuntime: 'Python 运行时',
    rtKatex: '公式样式',
    rtWebgl: 'WebGL',
    rtWasm: 'WebAssembly',
    rtRecorder: '浏览器导出',
    rtYes: '可用',
    rtNo: '不可用',
    rtReady: '就绪',
    rtIdle: '未加载',
    rtLoading: '加载中',
    rtError: '失败',
    rtLoaded: '已加载',
    rtUnconfigured: '未配置',
    rtHints: '{count} 项待处理',
    rtAllReady: '各项就绪',
    rtNoLoader: '加载器还没装上（本页还没人用过渲染器）',
    rtIndexWhy: '取数地址：{url}',
    rtKatexWhy: '没有配置公式样式的地址，公式会以无样式形态渲染。',
    rtKatexAt: '取数地址：{url}',
    rtWebglWhy: 'WebGL 是画面本身的出口；没有它，卡片渲染不出任何东西。',
    rtWasmWhy: 'WebAssembly 是 Python 解释器的运行基础；没有它，所有渲染都起不来。',
    rtRecorderWhy: '有它才能在浏览器里逐帧导出视频（WebCodecs 或 MediaRecorder）；缺它只影响导出，渲染不受影响。',

    // 卡片底部：渲染失败、且环境里确有挡住渲染的硬伤时，补一句解释
    renderEnvBlocked: '这台机器上还有条件没满足，可能正是它渲染不出来的原因：',

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
