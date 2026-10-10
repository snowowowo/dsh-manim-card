// Client 侧的 Pyodide 加载：宿主把随包的 Pyodide 挂在 /dsh-plugins/manim-renderer/pyodide，
// 这里注入 <script> 再 loadPyodide({ indexURL })。懒加载——第一次真要跑 Python 才拉（核心 ~13MB）。
import { setPyodideLoader, type PyodideRuntime } from '../../core/py/runtime.ts'

const PYODIDE_PATH = '/dsh-plugins/manim-renderer/pyodide'

type LoadPyodide = (options: { indexURL: string }) => Promise<PyodideRuntime>

let scriptPromise: Promise<void> | null = null
let installed = false

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Pyodide 脚本加载失败：${src}`))
    document.head.append(script)
  })
}

/** 登记 Pyodide 加载器（幂等——重复调用不能重置已缓存的运行时实例）。 */
export function installPyodideLoader(): void {
  if (installed) return
  installed = true
  setPyodideLoader(async () => {
    scriptPromise ??= loadScript(`${PYODIDE_PATH}/pyodide.js`)
    await scriptPromise
    const load = (globalThis as { loadPyodide?: LoadPyodide }).loadPyodide
    if (typeof load !== 'function') throw new Error('Pyodide 脚本已加载但未暴露 loadPyodide')
    return load({ indexURL: `${PYODIDE_PATH}/` })
  })
}