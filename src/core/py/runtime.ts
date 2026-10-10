/**
 * Python 运行时：跑在 Pyodide 上（真 CPython 编译成 WASM），numpy 是真的 numpy。
 *
 * 为什么不是 Skulpt：Skulpt 是纯 JS 的 Python 子集解释器，numpy 得我们自己手写——
 * 「撞到才补」的子集永远补不完（np.sin 补了还有 np.linspace，再往后还有 pandas）。
 * Pyodide 直接跑真 CPython，numpy 装上就能用。
 *
 * 随包只带 numpy + sympy（高频、且加起来才 7 MB）；代码里 import 了别的库时按需取：
 * 浏览器侧 Pyodide 只会去取 indexURL 那一个地址（源码里浏览器走 indexURL、且**不回落 CDN**），
 * 所以 Host 就在那条资源路由上把缺的包下载、按 lock 的 sha256 校验、落进用户缓存目录再发过去；
 * Node 侧（干跑预检）走它自己配的 packageCacheDir，同一个目录。
 *
 * 与 Skulpt 最大的不同是**同步模型**：Skulpt 靠 suspension 能在同步函数里等 Promise，
 * CPython 不行。所以 `construct` 会被改写成 `async def`、其中的 play/wait 补上 await
 * （见 manim-shim.ts 的 _AwaitTransform），由 runPythonAsync 的顶层 await 驱动。
 *
 * 本模块不关心 Pyodide 从哪来（Host 读本地目录、Client 走 HTTP 资源路由），
 * 由使用方用 setPyodideLoader 注入。
 */
import type { ManimBridge } from './bridge.ts'
import { MANIM_SHIM_SOURCE } from './manim-shim.ts'

/** Python 执行失败：带行号。Host 预检把它回给模型，卡片把它显示给用户。 */
export class PyRuntimeError extends Error {
  readonly line?: number
  constructor(message: string, line?: number) {
    super(line === undefined ? message : `第 ${line} 行：${message}`)
    this.name = 'PyRuntimeError'
    this.line = line
  }
}

/** Pyodide 实例中本模块用到的部分（不引 pyodide 的类型，两端加载方式不同）。 */
export interface PyodideRuntime {
  runPythonAsync(code: string): Promise<unknown>
  loadPackage(name: string): Promise<unknown>
  /**
   * 按源码里的 import 取包。两端取法不同、但用户代码看不出差别：
   * Client 侧走本机资源路由（宿主在那里按需下载、校验、落进用户缓存目录），
   * Host 侧走它自己配的 packageCacheDir。取不到**不 reject**，只逐个走 errorCallback。
   *
   * 可选：缺席时跳过取包这一步（测试里的替身运行时就不必实现它）。
   */
  loadPackagesFromImports?(
    code: string,
    options?: { messageCallback?: (text: string) => void; errorCallback?: (text: string) => void },
  ): Promise<unknown>
  setStdout(options: { batched: (text: string) => void }): void
  globals: { set(name: string, value: unknown): void }
}

/** 加载并初始化一个 Pyodide 实例（Host 与 Client 各有一套实现）。 */
export type PyodideLoader = () => Promise<PyodideRuntime>

let loader: PyodideLoader | null = null
let runtimePromise: Promise<PyodideRuntime> | null = null

/**
 * 注入 Pyodide 加载器。可在首次执行前调用多次——会丢弃已缓存的实例重新加载。
 */
export function setPyodideLoader(next: PyodideLoader): void {
  loader = next
  runtimePromise = null
}

/** print 的落点；每次 runPython 覆盖，跑完清空。 */
let outputSink: (text: string) => void = () => {}

/**
 * 把桥的六个动作注册成 Python 内置函数（只做一次）。
 * 用 `_mb_` 单下划线前缀：双下划线在 class 体内会被 Python 名字改编，适配层就调不到了。
 *
 * 名字以 `_` 开头，所以**不能**用 `js.xxx` 去取（Pyodide 的 js 模块不暴露下划线名），
 * 走 globals.set 直接落到 __main__ 全局里。
 */
const BRIDGE_BOOTSTRAP = `
import builtins as _builtins
import js as _js
from pyodide.ffi import to_js as _to_js

_CONVERT = _js.Object.fromEntries


def _to_py(value):
    return value.to_py() if hasattr(value, "to_py") else value


def _mb_create(kind, args, kwargs):
    return _to_py(_dsh_bridge.create(kind, _to_js(args, dict_converter=_CONVERT), _to_js(kwargs, dict_converter=_CONVERT)))


def _mb_method(handle, name, args, kwargs):
    return _to_py(_dsh_bridge.method(handle, name, _to_js(args, dict_converter=_CONVERT), _to_js(kwargs, dict_converter=_CONVERT)))


def _mb_getattr(handle, name):
    return _to_py(_dsh_bridge.getAttr(handle, name))


def _mb_add(handle, mobjects):
    _dsh_bridge.add(handle, _to_js(mobjects))


async def _mb_play(handle, animations, kwargs):
    return _to_py(await _dsh_bridge.play(handle, _to_js(animations, dict_converter=_CONVERT), _to_js(kwargs, dict_converter=_CONVERT)))


async def _mb_wait(handle, duration):
    return _to_py(await _dsh_bridge.wait(handle, duration))


async def _mb_flush():
    await _dsh_bridge.flush()


for _name in ("_mb_create", "_mb_method", "_mb_getattr", "_mb_add", "_mb_play", "_mb_wait", "_mb_flush"):
    setattr(_builtins, _name, globals()[_name])
`

/** 把适配层注册成 sys.modules['manim']——用户代码的 from manim import * 才能拿到它。 */
const MANIM_MODULE_SETUP = `
import sys as _sys
import types as _types
_dsh_manim = _types.ModuleType("manim")
exec(compile(_dsh_manim_src, "<manim-shim>", "exec"), _dsh_manim.__dict__)
_sys.modules["manim"] = _dsh_manim
`

const RUN_SNIPPET = 'import manim as _dsh_manim\nawait _dsh_manim._run_source(_dsh_src)\n'
const EXEC_SNIPPET = 'import manim as _dsh_manim\n_dsh_manim._exec_source(_dsh_src)\n'

async function getRuntime(): Promise<PyodideRuntime> {
  if (!loader) throw new Error('manim-renderer：未注入 Pyodide 加载器，无法执行 Python')
  runtimePromise ??= (async () => {
    const runtime = await loader!()
    // numpy 必须先装：适配层模块一 import 就要用
    await runtime.loadPackage('numpy')
    runtime.setStdout({ batched: (text) => outputSink(text) })
    runtime.globals.set('_dsh_manim_src', MANIM_SHIM_SOURCE)
    await runtime.runPythonAsync(BRIDGE_BOOTSTRAP)
    await runtime.runPythonAsync(MANIM_MODULE_SETUP)
    return runtime
  })()
  // 初始化失败要允许重试：把失败的 Promise 从缓存里摘掉，否则会一直拿到同一个拒绝
  runtimePromise.catch(() => {
    runtimePromise = null
  })
  return runtimePromise
}

export interface RunOptions {
  /** print 的输出落点（不传则丢弃）。 */
  output?: (text: string) => void
  /** 跑完是否自动找 Scene 子类执行 construct（默认 true）；纯 Python 片段可关掉。 */
  drive?: boolean
  /**
   * 按 import 取包的进展：开始取时回调一次（给包名），取完再回调一次（给空数组）。
   * 是否显示、显示多久由调用方定——随包件与缓存命中都快，不该闪一下提示。
   */
  onLoading?: (names: string[]) => void
  /**
   * 轮到这段代码时再问一次「调用方还在吗」。返回 false 就整段作废、连解释器都不碰——
   * 卡片滚出视口时画布已经拆了，硬跑的结果必然失败，而那条失败是自伤，不是渲染错误。
   */
  active?: () => boolean
}

/**
 * 这段运行在轮到自己时已经作废：调用方拆了画布、或压根没轮上（见下面的队列）。
 *
 * 单独一类而不是普通 Error：调用方要能把它和「用户代码跑错」分开——
 * 前者一个字都不该显示，后者必须原样报出来。
 */
export class PyRunCancelled extends Error {
  constructor() {
    super('运行已作废：轮到它时调用方已经拆了画布')
    this.name = 'PyRunCancelled'
  }
}

/**
 * 页面级的全局运行队列。
 *
 * 一个页面只有一份解释器、一套全局变量（`_dsh_bridge` / `_dsh_src` / 输出落点），
 * 而适配层的 play / wait / create 是**每次调用现取**这些全局的。两段用户代码同时在里面跑，
 * 后进的那段就把前一段的桥顶掉：前一段后半程的动作全打到别人的画布上（两张卡的内容挤在一块、另一块看着像没渲染），
 * 或者打到一张不存在对应句柄的表上，当场报「未知的对象句柄」。这正是「两张卡同屏就乱、报错过一会儿又没了」的根。
 *
 * 所以「一段跑完才准下一段进」是硬约束，不是优化。排队单位是**整段 runPython**——
 * 含按 import 取包与运行时初始化那几段 await：那几段正是让出解释器的地方，漏在队外等于没排。
 */
let queue: Promise<unknown> = Promise.resolve()

/** 排进队列，按提交顺序一段段跑；前一段失败不阻断后面排队的。 */
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job)
  queue = next.then(() => undefined, () => undefined)
  return next
}

/**
 * 完整 class 写法：源码里出现类定义，就当用户自己写好了外壳。
 *
 * ⚠️ 原来只认 `class X(Scene)`——`class X(ThreeDScene)` 会被误判成裸 construct 体，
 * 整段被缩进进函数后 `from manim import *` 不在模块层，报
 * `SyntaxError: import * only allowed at module level`（真机事故：Surface / SpecialThreeDScene
 * 两条语料就是这么挂的，报错完全指不到根因）。基类名五花八门（ThreeDScene / MovingCameraScene /
 * 以及 manim-web 没有的 SpecialThreeDScene），按名字白名单列不全，所以判「有没有类定义」。
 */
const SCENE_CLASS = /(^|\n)[ \t]*class\s+\w+\s*\(/

/** 用户代码里是否已经引入 manim。 */
const MANIM_IMPORT = /(^|\n)\s*(from\s+manim\s+import|import\s+manim\b)/

/** 只写 construct 体时套的外壳。行数固定，供行号还原用。 */
const CONSTRUCT_BODY_PREFIX = 'from manim import *\n\n\nclass _ManimScene(Scene):\n    def construct(self):\n'

/**
 * 两种输入形态都收：完整 class 外壳直接用；裸 construct 体套一层外壳。
 * 返回装入源码与行偏移——报错行号要减去偏移，才是用户视角的行号。
 */
function prepareSource(code: string): { source: string; lineOffset: number } {
  if (SCENE_CLASS.test(code)) {
    // 写了 import 就原样用；只写 class 外壳、漏了 import 时补一行，免得「Scene 未定义」的报错误导用户
    if (MANIM_IMPORT.test(code)) return { source: code, lineOffset: 0 }
    return { source: `from manim import *\n${code}`, lineOffset: 1 }
  }
  // def 已在 4 空格，体必须再进一级（8 空格）
  const body = code.split('\n').map((line) => (line.trim() === '' ? line : `        ${line}`)).join('\n')
  const prefixLines = CONSTRUCT_BODY_PREFIX.split('\n').length - 1
  return { source: CONSTRUCT_BODY_PREFIX + body, lineOffset: prefixLines }
}

/**
 * 执行一段 Manim Python。语法/运行错误统一抛 PyRuntimeError（带行号）。
 * 行号对应传入源码的行号。
 *
 * 入口即排队（见 queue）：同一时刻全页只有一段用户代码在解释器里跑。
 */
export async function runPython(code: string, bridge: ManimBridge, options: RunOptions = {}): Promise<void> {
  return enqueue(async () => {
    // 作废判定要在拿到队位之后：作废的活儿必须「到点直接丢」，不能占着队首也不算数。
    if (options.active?.() === false) throw new PyRunCancelled()
    return execute(code, bridge, options)
  })
}

async function execute(code: string, bridge: ManimBridge, options: RunOptions): Promise<void> {
  const runtime = await getRuntime()
  const drive = options.drive !== false
  const { source, lineOffset } = drive ? prepareSource(code) : { source: code, lineOffset: 0 }
  // 取包要排在接上输出落点之前：Pyodide 的取包过程会往 stdout 打它自己的消息
  // （实测「Didn't find package … locally, attempting to load from …」，
  // 「caching the wheel …」），那不是用户 print 的东西，混进来会污染卡片里回显的输出。
  await loadImports(runtime, source, options.onLoading)
  outputSink = options.output ?? (() => {})
  runtime.globals.set('_dsh_bridge', bridge)
  runtime.globals.set('_dsh_src', source)
  try {
    await runtime.runPythonAsync(drive ? RUN_SNIPPET : EXEC_SNIPPET)
  } catch (error) {
    throw toPyRuntimeError(error, lineOffset)
  } finally {
    outputSink = () => {}
  }
}

/** Pyodide 取包时的进度行（`Loading numpy, sympy`）。 */
const LOADING = /^Loading (.+)$/

/**
 * 按代码里的 import 把包准备好：随包的（numpy / sympy）本地就有，缺的由加载器去取。
 *
 * 取不到时抛一句人话——Pyodide 的失败**不走 reject、只走 errorCallback**（实测），
 * 不接住的话用户只会看到 `ModuleNotFoundError: No module named 'pandas'`，
 * 完全读不出「首次要联网、之后有缓存」这层信息。
 * 连不上的包名从 errorCallback 的标题行里取（`The following error occurred while loading scipy:`）。
 */
async function loadImports(
  runtime: PyodideRuntime,
  source: string,
  onLoading?: (names: string[]) => void,
): Promise<void> {
  if (typeof runtime.loadPackagesFromImports !== 'function') return
  const failures: string[] = []
  let announced = false
  try {
    await runtime.loadPackagesFromImports(source, {
      messageCallback: (text) => {
        const match = LOADING.exec(text.trim())
        if (match === null) return
        announced = true
        onLoading?.(match[1].split(',').map((name) => name.trim()))
      },
      errorCallback: (text) => failures.push(text),
    })
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error))
  } finally {
    if (announced) onLoading?.([])
  }
  if (failures.length === 0) return
  throw new PyRuntimeError(packageFailureMessage(failures))
}

/**
 * 把 Pyodide 的取包失败拼成一句人话。
 *
 * 失败消息成对出现（实测）：先一行标题 `The following error occurred while loading scipy:`，
 * 再一行原因。包名只在标题里，所以从标题里扣；原因是给用户看的唯一有效信息，取它、压平、限长。
 */
export function packageFailureMessage(failures: string[]): string {
  const names = [
    ...new Set(
      failures
        .map((text) => /while loading (\S+?):/.exec(text)?.[1])
        .filter((name): name is string => name !== undefined),
    ),
  ]
  const reason = failures
    .filter((text) => !text.startsWith('The following error occurred'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 160)
  const who = names.length > 0 ? `（${names.join('、')}）` : ''
  return `取不到代码里 import 的库${who}：${reason || '原因未知'}。首次用到需要联网取一次，取到后缓存在本机、之后离线也能用；也可以用 numpy 或标准库改写。`
}

/** 用户代码的栈帧长这样：`  File "<manim>", line 12, in construct`。 */
const MANIM_FRAME = /File "<manim>", line (\d+)/g

/** 取最深一层用户栈帧的行号（traceback 里最深的一帧在最后）。 */
function innermostLine(text: string): number | undefined {
  let last: number | undefined
  MANIM_FRAME.lastIndex = 0
  let match = MANIM_FRAME.exec(text)
  while (match !== null) {
    last = Number(match[1])
    match = MANIM_FRAME.exec(text)
  }
  return last
}

/** traceback 的最后一行就是异常摘要（如 `TypeError: ...`）；没有栈时退回原文。 */
function summarize(text: string): string {
  const lines = text.split('\n').filter((line) => line.trim() !== '')
  const last = lines[lines.length - 1]
  return last === undefined ? text.trim() : last.trim()
}

/**
 * 把 Pyodide 抛出的 PythonError 转成带行号的 PyRuntimeError。
 * 注意：PythonError 的 message 是**整段 traceback**，行号要从里面提取，
 * 文案只取最后一行（异常摘要），否则整段栈会回给模型。
 */
export function toPyRuntimeError(error: unknown, lineOffset = 0): PyRuntimeError {
  if (error instanceof PyRuntimeError) return error
  const text = error instanceof Error ? error.message : String(error)
  const raw = innermostLine(text)
  const line = raw !== undefined && raw - lineOffset > 0 ? raw - lineOffset : undefined
  return new PyRuntimeError(summarize(text), line)
}