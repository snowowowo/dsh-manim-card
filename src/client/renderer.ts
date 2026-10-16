// 本插件全页唯一的 Manim 渲染器：卡片画布与预检的唯一来源。
//
// 为什么是**模块级单例**：核心包的 WASM 运行时与串行执行队列本来就是**页面级单例**，
// 造两个渲染器只会多插一份 KaTeX `<link>`、多记一份「谁造的画布」的账，没有半点好处。
//
// 懒建：本模块被 import 时不碰 DOM（核心包的工厂会注入 KaTeX 样式、登记 Pyodide 加载器），
// 第一次真要渲染时才建。**建它这件事本身有副作用**——环境状态里的运行时地址与 KaTeX 地址
// 就是工厂登记进去的，所以入口在插件加载时先建一次（见 ./index.tsx），设置页的读数才不会空着。
import { createManimRenderer, type ManimRenderer } from 'manim-live'
import { KATEX_ROUTE, PYODIDE_ROUTE } from '../routes.js'

let renderer: ManimRenderer | null = null

export function manimRenderer(): ManimRenderer {
  renderer ??= createManimRenderer({
    // 两条都指向本插件自己的 Host 路由——真源见 `src/routes.js`，与 Host 注册的是同一个值
    // （改一边忘一边的 404 从根上堵死）。核心包不知道使用者的资源挂在哪，所以这是**配置**，
    // 不是它写死的常量；想换 CDN / 自托管也只需改这一行。
    pyodideIndexURL: PYODIDE_ROUTE,
    katexBaseURL: KATEX_ROUTE,
  })
  return renderer
}

/**
 * 释放渲染器（插件卸载时调，之后 `manimRenderer()` 会重新建一个）。
 *
 * 核心包的 `dispose()` 会真释放 WASM / WebGL、拆掉本实例造过的所有画布、摘掉注入的 KaTeX 样式。
 * 这一步必须做——宿主不管这件事，漏一次就是一次内存泄漏。
 */
export function disposeManimRenderer(): void {
  renderer?.dispose()
  renderer = null
}
