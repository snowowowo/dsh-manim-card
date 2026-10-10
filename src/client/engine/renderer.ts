// 画布（Surface）：一块固定 1280×720 的 manim 画布 + 串行执行队列。
// 对外只有两个动作——run(code) 跑一段、dispose() 拆掉；多次 run 按提交顺序串行（画布是单写入方）。
//
// 代码路径：AI 的 Manim Python → Pyodide 里的真 CPython → manim 适配层 → 桥 → 这块真场景。
// 每次 run 用一块新桥（句柄表重新计数），句柄不跨次串味。
import { PyRuntimeError, runPython } from '../../core/py/runtime.ts'
import { createManimWebBridge, type ManimNamespace } from '../../core/py/manim-bridge.ts'
import { createScene, type ManimScene } from './canvas.ts'
import { loadManim } from './library.ts'
import { installPyodideLoader } from './pyodide.ts'

const WIDTH = 1280
const HEIGHT = 720

export interface RunResult {
  ok: boolean
  error?: string
}

export interface RunHandlers {
  /** 按 import 取包时的进展：开始时给包名，取完给空数组（见 core 的 RunOptions.onLoading）。 */
  onLoading?: (names: string[]) => void
}

export interface Surface {
  /** 跑一段 Manim Python（内部交给 Pyodide 执行并驱动画布）。 */
  run(code: string, handlers?: RunHandlers): Promise<RunResult>
  /** 拆掉这块画布；之后 run 一律失败。 */
  dispose(): void
}

export interface SurfaceOptions {
  /** 极速：不等时间，直接落终态（实验场「全部渲染」用，见 manim-bridge 的 fast）。 */
  fast?: boolean
}

/** 在给定容器里造一块画布。契约：容器由调用方给、由调用方管生命周期。 */
export async function createSurface(container: HTMLDivElement, options: SurfaceOptions = {}): Promise<Surface> {
  installPyodideLoader()
  const manim = await loadManim()
  const scene: ManimScene = createScene(container, manim, WIDTH, HEIGHT)

  let tail: Promise<unknown> = Promise.resolve()
  let disposed = false

  return {
    run(code: string, handlers: RunHandlers = {}): Promise<RunResult> {
      const job = tail.then(async () => {
        if (disposed) throw new Error('surface 已拆掉')
        const bridge = createManimWebBridge({
          manim: manim as unknown as ManimNamespace,
          scene,
          fast: options.fast === true,
        })
        await runPython(code, bridge, {
          output: (text) => console.info('[manim-renderer] print:', text.trimEnd()),
          onLoading: handlers.onLoading,
        })
      })
      tail = job.catch(() => {}) // 前一段失败不阻断后面排队的分段
      return job.then(
        () => ({ ok: true }),
        (error: unknown) => {
          console.error('[manim-renderer] run failed:', error)
          const message = error instanceof PyRuntimeError ? error.message : String(error)
          return { ok: false, error: message }
        },
      )
    },
    dispose(): void {
      disposed = true
      try {
        // scene.dispose() 释放 mobject、WebGL 上下文与 resize 观察者，并从容器摘掉 canvas。
        scene.dispose()
      } catch (error) {
        console.error('[manim-renderer] scene dispose failed:', error)
      }
    },
  }
}
