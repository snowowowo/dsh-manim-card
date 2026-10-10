/**
 * 构建预设见同目录 `tsdown.preset.ts`（每个插件包自带一份，逐字节相同；唯一源是 dsh-plugin-template 仓）。
 * 本插件有两个产物：
 *   - client.js  浏览器半边（共享预设；Python 运行时与渲染都在这一侧）
 *   - core.js    Host 半边用的 Python 运行时（`src/core/index.ts` → Node ESM，全量内联自包含）——
 *                工具返回前先干跑一遍，语法错 / 未定义名 / 缺失 API 当场回给模型
 */
import { clientBundle } from './tsdown.preset.ts'

export default [
  ...clientBundle({ entry: 'src/client/index.tsx' }),
  {
    // Host 免构建只对 JS 成立：两端共用的 TS 运行时要单独编成 host 可执行的 ESM。
    // Pyodide 不在这里——它由 host/index.js 在运行时从 assets/pyodide 动态 import，
    // 不进产物（13MB 的 wasm 与 zip 只该走资源路由）。
    entry: { core: 'src/core/index.ts' },
    outDir: '.',
    format: 'esm',
    platform: 'node',
    dts: false,
    sourcemap: false,
    clean: false,
    outputOptions: { entryFileNames: 'core.js' },
  },
]
