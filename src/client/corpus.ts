/**
 * 实验场语料的取用：**运行时向 Host 取**，不从产物里读。
 *
 * 为什么这么绕：这批语料是开发期的回归网，不是产品功能——以前它被 `gen-examples.mjs` 编成
 * `examples.generated.ts` 打进 `client.js`，等于让每个用户都背上一个只有开发者才用的页面。
 * 现在语料本体在**包外**的插件仓 `_dev/examples/`，浏览器通过
 * `GET /dsh-plugins/manim-renderer/corpus` 拿：开发机拿得到，正式安装拿到空表，
 * 页面据此退化成「自定义代码」那一半。
 *
 * 这就是「实验场降为开发用」的落点——不是加开关，而是**语料根本不在包里**。
 *
 * 清包缓存（`POST …/cache`）搬去 ./packages.ts 了：那是包缓存的事，跟语料无关。
 */
import { useEffect, useState } from 'react'
import { parseCorpus, type Corpus } from '../core/py/examples.ts'
import { CORPUS_ROUTE, SHOTS_ROUTE } from '../core/routes.ts'

/**
 * 语料截图的静态资源前缀（真源在 `core/routes.ts`，与 Host 注册的是同一个值）。
 * 每条语料的图就是 `${SHOTS_ROUTE}/${example.shot}`（`shot` 由 Host 只在文件真在时才带上）。
 */
export const SHOTS_URL = SHOTS_ROUTE

export type CorpusState =
  /** 正在取（本机路由，正常是毫秒级）。 */
  | { status: 'loading' }
  /** 拿到了语料。 */
  | { status: 'ready'; corpus: Corpus }
  /** Host 答了，但那台机器没有语料目录——正式安装里的正常状态，不是故障。 */
  | { status: 'devOnly' }
  | { status: 'error'; message: string }

/** 模块级缓存 + 单飞：切视图 / 重挂页面都不再重取。 */
let settled: CorpusState | null = null
let inflight: Promise<CorpusState> | null = null

/**
 * 把一次语料响应收成状态。
 *
 * **空表 = 这台机器上没有语料**（正式安装的常态），不是错误——页面据此退化成「自定义代码」。
 * 这一条是「实验场降为开发用」的关键判据，所以它跟取数的 I/O 分开、单独可测。
 * 响应正文是**不可信输入**，形状交给 parseCorpus 校验。
 */
export function corpusStateFrom(status: number, payload: unknown): CorpusState {
  if (status < 200 || status >= 300) return { status: 'error', message: `HTTP ${status}` }
  const corpus = parseCorpus(payload)
  return corpus.examples.length === 0 ? { status: 'devOnly' } : { status: 'ready', corpus }
}

/**
 * 取一次语料（I/O + 形状校验）。**导出供单测直接驱动**——`useCorpus` 那层是 hooks，
 * 没有 DOM 跑不起来，但「网络断了 / 正文不是 JSON / 空表」这几条分支正是最容易出错的。
 */
export async function loadCorpus(): Promise<CorpusState> {
  let response: Response
  try {
    response = await fetch(CORPUS_ROUTE)
  } catch (error) {
    // 本机路由都连不上：多半是 Host 没起来或插件没加载
    console.error('[manim-renderer] 取语料失败:', error)
    return { status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
  let payload: unknown = null
  if (response.ok) {
    try {
      payload = await response.json()
    } catch (error) {
      console.error('[manim-renderer] 语料不是合法 JSON:', error)
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  }
  const next = corpusStateFrom(response.status, payload)
  if (next.status === 'error') console.error(`[manim-renderer] 取语料失败：${next.message}`)
  return next
}

/** 读一次语料；同一页面内只发一次请求。 */
export function useCorpus(): CorpusState {
  const [state, setState] = useState<CorpusState>(() => settled ?? { status: 'loading' })
  useEffect(() => {
    if (settled !== null) return
    let alive = true
    inflight ??= loadCorpus().then((next) => {
      settled = next
      return next
    })
    void inflight.then((next) => {
      if (alive) setState(next)
    })
    return () => {
      alive = false
    }
  }, [])
  return state
}
