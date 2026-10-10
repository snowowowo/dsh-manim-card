/**
 * Pyodide 包缓存：清单、预缓存、清缓存——设置页与实验场共用这一层。
 *
 * 为什么「取一个包要连依赖一起取」在**客户端**算：Host 只回答「每个包现在在本地是什么状态」，
 * 而依赖关系是 lock 里的静态数据（跟着清单一起发过来）。算在客户端，取的时候就能**一个一个来**——
 * 进度、失败、停下来都在这一层看得见，而不是让 Host 闷头取完一大串才回话。
 */

const PACKAGES_URL = '/dsh-plugins/manim-renderer/packages'
const CACHE_URL = '/dsh-plugins/manim-renderer/cache'

/** 一个包在本地的三种状态：随包来 / 本机取回来的 / 要用得联网。 */
export type PackageState = 'bundled' | 'cached' | 'absent'

export interface PackageEntry {
  name: string
  version: string
  fileName: string
  /** lock 里的 `package_type`：`package` / `shared_library` / `cpython_module`。 */
  kind: string
  /** 依赖的包名。取一个包时要把它们一起取，否则「提前缓存」等于没做。 */
  depends: string[]
  /** 能 `import` 的名字，通常与包名一致，少数不一致（如 `pillow` → `PIL`）。 */
  imports: string[]
  state: PackageState
  /** 本机占用的字节数；没在本地（或随包件还没就位）时是 null。 */
  bytes: number | null
}

export interface PackageInventory {
  cacheDir: string
  pyodideVersion: string
  entries: PackageEntry[]
}

/** 预缓存一个包的结果。 */
export interface PrefetchOutcome {
  ok: boolean
  /** 这次真的下了多少字节（本来就在本地的包是 0）。 */
  bytes: number
  /** 失败原因（已成人话）；成功时是空串。 */
  error: string
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/**
 * 一条包记录。**响应是不可信输入**（本机路由也会随插件换版而变），逐字段过一遍。
 * 单条不合格就丢这一条，而不是整表作废——一个包名变了不该让整个页面空掉。
 */
function parseEntry(raw: unknown): PackageEntry | null {
  if (raw === null || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  if (typeof value.name !== 'string' || value.name.length === 0) return null
  if (typeof value.fileName !== 'string' || value.fileName.length === 0) return null
  const state = value.state
  if (state !== 'bundled' && state !== 'cached' && state !== 'absent') return null
  return {
    name: value.name,
    version: typeof value.version === 'string' ? value.version : '',
    fileName: value.fileName,
    kind: typeof value.kind === 'string' ? value.kind : 'package',
    depends: strings(value.depends),
    imports: strings(value.imports),
    state,
    bytes: typeof value.bytes === 'number' && Number.isFinite(value.bytes) ? value.bytes : null,
  }
}

/** 把清单响应收成形状确定的值；形状不对回 null（调用方据此报错）。 */
export function parseInventory(payload: unknown): PackageInventory | null {
  if (payload === null || typeof payload !== 'object') return null
  const value = payload as Record<string, unknown>
  if (typeof value.cacheDir !== 'string' || !Array.isArray(value.entries)) return null
  const entries = value.entries.map(parseEntry).filter((entry): entry is PackageEntry => entry !== null)
  return {
    cacheDir: value.cacheDir,
    pyodideVersion: typeof value.pyodideVersion === 'string' ? value.pyodideVersion : '',
    entries,
  }
}

/** 读一次包清单。失败抛错给调用方去显示（这是用户主动触发的动作，不该静默）。 */
export async function loadPackages(): Promise<PackageInventory> {
  const response = await fetch(PACKAGES_URL)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const inventory = parseInventory(await response.json())
  if (inventory === null) throw new Error('清单形状不对（插件版本与宿主对不上？）')
  return inventory
}

/**
 * 取一个包要连哪些一起取：它自己的依赖闭包，**依赖排在前面**。
 *
 * 两个细节：
 *  - 已经在本地的（随包 / 已缓存）不进计划——但它的**依赖仍要往下看**，
 *    否则「A 缓存了、A 的依赖没缓存」这种半拉状态会被漏过去；
 *  - 顺序是后序（先依赖后本体），于是中途停下来时，已经落地的部分是一个**自洽的前缀**。
 * @param entries - Host 给的清单。
 * @param name - 想取的包名。
 * @returns 要取的名字；清单里没有这个包时回空数组（调用方据此说「不认识的包」）。
 */
export function prefetchPlan(entries: readonly PackageEntry[], name: string): string[] {
  const byName = new Map(entries.map((entry) => [entry.name, entry]))
  const root = byName.get(name)
  if (root === undefined) return []
  const ordered: string[] = []
  const seen = new Set<string>()
  const visit = (entry: PackageEntry): void => {
    if (seen.has(entry.name)) return
    seen.add(entry.name)
    for (const dependency of entry.depends) {
      const next = byName.get(dependency)
      if (next !== undefined) visit(next)
    }
    if (entry.state === 'absent') ordered.push(entry.name)
  }
  visit(root)
  return ordered
}

/**
 * 按名字取一个包（一个包一次请求）。
 * 失败不抛、改成回一句结果——批量取的时候一次失败不该把整轮断在半路，
 * 调用方拿 `ok` 决定是继续还是收摊。
 */
export async function cachePackage(name: string): Promise<PrefetchOutcome> {
  let response: Response
  try {
    response = await fetch(`${PACKAGES_URL}/cache`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ names: [name] }),
    })
  } catch (error) {
    console.error(`[manim-renderer] 取包失败（${name}）：`, error)
    return { ok: false, bytes: 0, error: error instanceof Error ? error.message : String(error) }
  }
  if (!response.ok) {
    console.error(`[manim-renderer] 取包失败（${name}）：HTTP ${response.status}`)
    return { ok: false, bytes: 0, error: `HTTP ${response.status}` }
  }
  const body = (await response.json()) as { results?: unknown }
  const first = Array.isArray(body.results) ? body.results[0] : undefined
  if (first === null || typeof first !== 'object') return { ok: false, bytes: 0, error: 'Host 没有回报结果' }
  const result = first as { state?: unknown; bytes?: unknown; error?: unknown }
  if (typeof result.error === 'string' && result.error.length > 0) {
    console.error(`[manim-renderer] 取包失败（${name}）：${result.error}`)
    return { ok: false, bytes: 0, error: result.error }
  }
  return { ok: true, bytes: typeof result.bytes === 'number' ? result.bytes : 0, error: '' }
}

/** 清掉本机缓存的按需包（Host 只删自己缓存目录里的包文件）。失败抛给调用方去显示。 */
export async function clearPackageCache(): Promise<string[]> {
  const response = await fetch(CACHE_URL, { method: 'POST' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const body: unknown = await response.json()
  if (body === null || typeof body !== 'object') return []
  const removed = (body as { removed?: unknown }).removed
  return Array.isArray(removed) ? removed.filter((name): name is string => typeof name === 'string') : []
}

/** 字节数成人话（清单里最大的包几十 MB，用两位有效数字足够）。 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

/** 包状态对应的文案键（随包 / 已缓存 / 未缓存）。 */
export function stateKey(state: PackageState): string {
  return state === 'bundled' ? 'pkgBundled' : state === 'cached' ? 'pkgCached' : 'pkgAbsent'
}
