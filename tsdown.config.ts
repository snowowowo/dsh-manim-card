/**
 * 构建预设见同目录 `tsdown.preset.ts`（每个插件包自带一份，逐字节相同；唯一源是 dsh-plugin-template 仓）。
 *
 * 本插件只有**一个**产物：
 *   - client.js  浏览器半边（共享预设）——画布与卡片 UI 都在这一侧；
 *                真正的 Python 运行时与渲染机制来自核心包 `manim-live`，由预设内联进本产物。
 *
 * Host 半边（`src/host/*.js`）是**免构建的普通 JS**，原样发布，不在这里。
 *
 * 抽包（Phase 1）之前这里还有第二个产物 `core.js`——那是「两端共用的 Python 运行时」在本仓的
 * Node 副本。现在那份运行时归核心包（`manim-live/node`），Host 直接 `import` 它，
 * 于是本仓不再需要任何 Node 侧产物（顶层设计 §4.1 / §8.1）。
 */
import { clientBundle } from './tsdown.preset.ts'

export default [...clientBundle({ entry: 'src/client/index.tsx' })]
