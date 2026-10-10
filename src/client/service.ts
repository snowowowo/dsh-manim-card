// 对外服务 `manim`：别的插件（将来的黑板）经 `ctx.get('manim')` 拿到的一件事——**运行时 + 一块画布**。
//
// 就两件：干跑预检与造画布。卡片 UI、Host 工具、分步播放/播放头/旁白都不在这里——
// 前两件是本插件自己的入口，后一类是调用方（黑板）自己的事（见顶层设计 §5、§6）。
// 插件之间禁止 import，所以这是唯一的协作面：服务缺席时调用方退化成「没有画布」，不报错、不阻塞。
import { createDryRunBridge } from '../core/py/dry-run-bridge.ts'
import { runPython } from '../core/py/runtime.ts'
import { createSurface, type Surface } from './engine/renderer'
import { installPyodideLoader } from './engine/pyodide'

export interface CheckResult {
  ok: boolean
  error?: string
}

export interface ManimService {
  /** 干跑预检：语法错 / 未定义名 / manim-web 实测缺失项当场回 ok:false，调用方不必再自校验一份。 */
  check(python: string): Promise<CheckResult>
  /** 在给定容器里造一块 manim 画布；容器由调用方给、生命周期也由调用方管。 */
  createSurface(container: HTMLDivElement): Promise<Surface>
}

export function createManimService(): ManimService {
  return {
    async check(python: string): Promise<CheckResult> {
      // check 可能先于任何画布被调用，这时 Pyodide 加载器还没装上（createSurface 里才装）
      installPyodideLoader()
      try {
        await runPython(python, createDryRunBridge())
        return { ok: true }
      } catch (error) {
        console.error('[manim-renderer] check failed:', error)
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
    createSurface(container: HTMLDivElement): Promise<Surface> {
      return createSurface(container)
    },
  }
}
