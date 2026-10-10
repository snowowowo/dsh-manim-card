/**
 * dsh 插件客户端 bundle 的构建预设——**每个插件包自带一份**。
 *
 * 为什么不放仓外共享：插件已拆成独立仓（一个功能 = 一个仓），仓之间没有共享文件系统，
 * 预设若留在外面，每个仓就没法独立构建。所以它跟着包走。
 * **`dsh-plugin-template` 仓里的这份是唯一源**；本文件在其余包里必须与它**逐字节相同**，
 * 由容器工作目录仓的 `scripts/check-preset-drift.mjs` 自动核对。
 * 改预设 → 先改 dsh-plugin-template，再把同一份复制到其余包；**不要单独改某一个包**。
 *
 * 复刻官方预设（dsh 源码 packages/client/tsdown.client.ts）的产物形态：
 *   - CJS 单文件，banner/footer 包成 window.__ModuleLoader__.load({ id, factory })，
 *   - 宿主冻结模块表（平台基座词）外部化，运行时由工厂 require 解析，绝不进产物，
 *   - 其余依赖一律内联，
 *   - purity gate 拒绝 Node builtin 与非基座 @deepseek-ai/* 值导入
 *     （跨插件协作走 cordis 服务，不走 value import）。
 *
 * 插件侧只写：
 *   import { clientBundle } from './tsdown.preset.ts'
 *   export default clientBundle({ entry: 'src/client/index.tsx' })
 * **banner 的 id 由预设从 package.json 的 name 派生，不是调用方传参**——见 packageName()。
 *
 * 前提：tsdown 的工作目录是被构建的插件包（`pnpm --filter <name> build` 即如此）
 * ——包名、lucide-react 入口、CSS 的包根都按该目录解析。
 * 本文件顶层 import 了 postcss / @tailwindcss/postcss / lightningcss，
 * 所以**每个包都要声明这三个构建依赖**（即使 css: false）——这样五份预设才能逐字节一致，
 * 漂移检查才是一句 diff。
 */
import { builtinModules, createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve as resolvePath } from 'node:path'
import { transform as minifyCss } from 'lightningcss'
import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'
import type { UserConfig } from 'tsdown'

/**
 * 宿主冻结模块表的完整基座词——dsh 源码 `packages/client/web/src/platform.ts`
 * 的 `PLATFORM_MODULES`。
 *
 * 外壳把这张表静态播种进客户端的模块表；动态 bundle 必须把**整张表**外部化，
 * 运行时由宿主在工厂 `require` 时解析。只有这些词允许出现在产物的 require 里
 * （基座词是隐式的，不要写进 `dsh.client.external`）。
 */
export const PLATFORM_MODULES: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/** Virtual-id wrapper keeping module CSS away from tsdown's own css pipeline. */
const CSS_VIRTUAL_PREFIX = '\0plugin-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'
/** 文本模式：`.css` 不编译，整份内容当 JS 字符串导出（esbuild `--loader:.css=text` 等价）。 */
const CSS_TEXT_PREFIX = '\0plugin-css-text:'

const NODE_BUILTINS = new Set([...builtinModules, ...builtinModules.map((id) => `node:${id}`)])

export interface ClientBundleOptions {
  /** 入口，默认 `src/client/index.tsx`。 */
  entry?: string
  /** 是否挂 tailwind CSS 管线（默认 true）；不用 tailwind 的插件关掉。 */
  css?: boolean
  /** 基座表之外额外要外部化的模块。 */
  extraExternals?: readonly string[]
  /** 按「文本」内联的 `.css` 说明符（原样作字符串导出，不走 tailwind）。 */
  cssText?: readonly string[]
}

/** 生成插件客户端 bundle 的 tsdown 配置。 */
export function clientBundle(options: ClientBundleOptions = {}): UserConfig[] {
  const { entry = 'src/client/index.tsx', css = true, extraExternals = [], cssText = [] } = options
  const id = packageName()
  const externals: readonly string[] = [...PLATFORM_MODULES, ...extraExternals]
  const alias = lucideAlias()

  return [
    {
      entry: { client: entry },
      outDir: '.',
      format: 'cjs' as const,
      platform: 'browser' as const,
      dts: false,
      sourcemap: false,
      clean: false,
      deps: {
        // 模块表词不打包，运行时由宿主 seed 解析。
        neverBundle: [...externals],
        // tsdown 默认把 package.json dependencies/peerDependencies 全 external，
        // 但宿主表只有基座那几个词——其余必须强制内联进产物，
        // 否则运行时报 require("x") missed the module table。
        alwaysBundle: (specifier: string) => !externals.includes(specifier),
      },
      plugins: [
        purityGate(externals),
        ...(css || cssText.length > 0 ? [makeCssPlugin(id, cssText)] : []),
      ],
      inputOptions: Object.keys(alias).length > 0 ? { resolve: { alias } } : {},
      outputOptions: {
        entryFileNames: 'client.js',
        banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
        footer: `return module.exports; } });`,
        intro: 'var module = { exports: {} }; var exports = module.exports;',
        codeSplitting: false,
      },
    },
  ]
}

/**
 * 客户端 bundle 注册的 id **必须等于包名**，所以从 `package.json` 派生，不给调用方传参。
 *
 * 依据：dsh 源码 `packages/client/modules/src/client/manifest.ts` 的 `BootModuleRow`
 * ——`id` 的注释就是「Entry name == package name」；加载器在 `client/system.ts` 的
 * `arrive()` 里拿 `__ModuleLoader__.load({ id })` 的 id 与 boot 行的 `row.id` 比对，
 * 对不上就判「loaded without registering」→ 退回单文件 URL 重跑 → 第二次执行又注册同一个
 * id，报「duplicate factory registration」，整包加载失败。包名加 `dsh-` 前缀而这里没跟上，
 * 就是 2026-10-10 那次 4 个插件集体加载失败的成因。
 *
 * 顺带把工作目录也守住：没声明 `dsh.client` 的包不该构建 client bundle，
 * 在包根之外跑构建会当场报错，而不是产出一个 id 错的产物。
 */
function packageName(): string {
  const manifest = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
    name?: unknown
    dsh?: { client?: unknown }
  }
  if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
    throw new Error('client bundle: package.json 缺 name —— 模块表的键无从确定')
  }
  if (manifest.dsh?.client === undefined) {
    throw new Error(
      `client bundle: "${manifest.name}" 未声明 dsh.client —— 不是客户端包，不该构建 client bundle`
      + '（tsdown 的工作目录是包根吗？）',
    )
  }
  return manifest.name
}

/**
 * lucide-react 无 exports 字段，CJS 构建下会解析到不可 tree-shake 的 main
 * (dist/cjs)，整包进产物。钉到 ESM 入口后具名 import 才裁得掉未用图标。
 * 只给声明了该依赖的插件加——没装的插件不白报错。
 * 入口文件名随版本变过（旧版 .mjs、新版 .js），按实际存在挑一个。
 */
function lucideAlias(): Record<string, string> {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  if (!('lucide-react' in declared(manifest))) return {}
  const require = createRequire(join(process.cwd(), 'package.json'))
  const esmDir = join(dirname(require.resolve('lucide-react/package.json')), 'dist', 'esm')
  const entry = ['lucide-react.mjs', 'lucide-react.js']
    .map((file) => join(esmDir, file))
    .find((path) => existsSync(path))
  if (entry === undefined) return {}
  return { 'lucide-react': entry }
}

const declared = (manifest: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }) =>
  ({ ...manifest.dependencies, ...manifest.devDependencies })

function purityGate(externals: readonly string[]) {
  return {
    name: 'dsh-client-bundle-purity',
    resolveId(source: string) {
      if (NODE_BUILTINS.has(source)) {
        throw new Error(
          `client bundle purity: Node builtin "${source}" cannot run in the browser module table`,
        )
      }
      if (source.startsWith('@deepseek-ai/') && !externals.includes(source)) {
        throw new Error(
          `client bundle purity: "${source}" is not a platform module — cross-plugin value imports are forbidden`,
        )
      }
      return null
    },
  }
}

/**
 * Tailwind v4 → lightningcss → <style data-plugin-css> 注入。
 * resolveId 把 .css 拦成虚拟 .mjs 模块（绕开 tsdown 自身 css 管线），load 里
 * 先跑 postcss(tailwindcss) 编译出最终 CSS，再 lightningcss 压缩，最后以
 * 工厂执行时注入 <style data-plugin-css> 的 JS 返回。
 * 跳过 preflight 由插件自己的 styles.css 只引 theme + utilities 实现。
 */
function makeCssPlugin(id: string, cssText: readonly string[]) {
  const tailwind = postcss([tailwindcss()])
  const require = createRequire(join(process.cwd(), 'package.json'))

  /** `.css` 说明符 → 绝对路径（裸包名走 node 解析，相对说明符相对 importer）。 */
  function locate(source: string, importer: string | undefined): string {
    if (!source.startsWith('.') && !source.startsWith('/')) return require.resolve(source)
    return importer === undefined ? resolvePath(source) : resolvePath(dirname(importer), source)
  }

  /**
   * 虚拟 id 里只放相对包根的路径：rolldown 会把模块 id 原样写进产物的 `#region` 注释，
   * 存绝对路径等于把构建机路径刻进 `client.js`（不同机器构建出的产物就不一致了）。
   * `load` 再相对包根还原，读文件仍用绝对路径。
   */
  const toVirtualId = (fileId: string) => relative(process.cwd(), fileId)
  const fromVirtualId = (virtualPath: string) => resolvePath(process.cwd(), virtualPath)

  return {
    name: 'plugin-css-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.css')) return null
      const mode = cssText.includes(source) ? CSS_TEXT_PREFIX : CSS_VIRTUAL_PREFIX
      return mode + toVirtualId(locate(source, importer)) + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (virtualId.startsWith(CSS_TEXT_PREFIX)) {
        const fileId = fromVirtualId(virtualId.slice(CSS_TEXT_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length))
        return `export default ${JSON.stringify(await readFile(fileId, 'utf8'))};`
      }
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = fromVirtualId(virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length))
      const source = await readFile(fileId, 'utf8')
      const { css } = await tailwind.process(source, { from: fileId })
      const { code } = minifyCss({ filename: fileId, code: Buffer.from(css), minify: true })
      return [injectTag(id, fileId, new TextDecoder().decode(code)), 'export default "";'].join('\n')
    },
  }
}

/** 工厂执行时按文件注入唯一的 <style data-plugin-css>。 */
function injectTag(id: string, fileId: string, cssSource: string): string {
  const tagId = `${id}/${basename(fileId)}`
  return [
    `const css = ${JSON.stringify(cssSource)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {`,
    `  const tag = document.createElement('style');`,
    `  tag.dataset.plugin = ${JSON.stringify(id)};`,
    `  tag.dataset.pluginCss = tagId;`,
    `  tag.textContent = css;`,
    `  document.head.appendChild(tag);`,
    `}`,
  ].join('\n')
}
