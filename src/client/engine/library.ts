// manim-web 加载单例：懒加载 + 缓存，多块画布共用同一份模块（重量级库只初始化一次）。
export type ManimRuntime = typeof import('manim-web')

let cached: Promise<ManimRuntime> | null = null

export function loadManim(): Promise<ManimRuntime> {
  cached ??= import('manim-web')
  return cached
}
