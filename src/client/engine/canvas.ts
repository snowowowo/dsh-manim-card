// 画布原语：建一块 manim-web 场景。
// 代码执行不在这里——AI 写的 Manim Python 交给 Pyodide 运行时（core/py），由桥驱动这块场景。
import type { ManimRuntime } from './library.ts'

/**
 * 画布场景（manim-web 的 Scene 实例）：只声明本模块真正用到的成员。
 * 库自带的类型与运行时对象不完全一致，故按用途做结构类型，构造处显式转换。
 */
export interface ManimScene {
  mobjects: Set<unknown>
  camera: { frameHeight: number; frameWidth: number }
  remove(...mobjects: unknown[]): void
  play(...animations: unknown[]): Promise<void>
  dispose(): void
}

export function createScene(
  container: HTMLDivElement,
  manim: ManimRuntime,
  width: number,
  height: number,
): ManimScene {
  const scene = new manim.Scene(container, {
    width: Math.max(width, 320),
    height: Math.max(height, 240),
    autoResize: false, // 尺寸由本模块受控（规避容器测量反馈放大）
    backgroundOpacity: 0, // 背景全透明：融入卡片，明暗主题由宿主透出
  }) as unknown as ManimScene
  try {
    // 画面坐标系对齐标准 Manim：高度恒 8 单位、宽度按画布比例（16:9 → 14.22），
    // 恰好等于 Manim 默认 frame（14.22×8）——AI 按标准坐标写（to_edge、LEFT*4 等）不会出界。
    // 勿改小：frame 一旦偏离标准，AI 心中的默认坐标系就失效，内容会被裁切（曾用 5 导致此事故）。
    scene.camera.frameHeight = 8
    scene.camera.frameWidth = 8 * (width / height)
  } catch (error) {
    console.error('[manim-renderer] camera frame normalize failed:', error)
  }
  return scene
}
