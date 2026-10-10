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
    clearCache: '清除包缓存',
    clearCacheHint: '删掉本机缓存的按需取回的第三方包（~/.dsh/cache/manim-renderer/pyodide）。想再看一次「首次取包」、或让某个包重新联网取，就用它；已经加载进当前页面的包要刷新页面才会卸掉。',
    cacheCleared: '已清掉 {count} 个包缓存',
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
      '这段代码 import 了随包之外的库（{names}），正在取一次。首次用到需要联网，取到后缓存在本机、之后离线也能用；下一次不会再等。',

    cardLabel: 'Manim 动画',
    replay: '重新播放',
    showCode: '查看代码',
    hideCode: '收起代码',
    copy: '复制代码',
    copied: '已复制',
    badCard: '卡片数据不完整（缺少 python 源码）',
    rejected: '代码未通过预检，未渲染',
  },
}
