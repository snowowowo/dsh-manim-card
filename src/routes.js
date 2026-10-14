/**
 * 本插件**全部** HTTP 路由的唯一真源——Host 注册与 Client 请求用的是同一个值。
 *
 * 为什么要有这个文件：同一条路径此前在 Host（注册路由）与 Client（fetch / 拼 `<img>` 地址）
 * 各写一遍，改一边忘一边就是 404，而 TS 编译器帮不上忙（两边都是普通字符串）。
 *
 * 为什么它在 `src/` 根、而且是 `.js`：抽包（Phase 1）之前它顶着「两端共用层」的名分待在
 * `src/core/routes.ts`。抽包之后 `src/core/` 整块搬去了核心包 `manim-live`，只剩这一份常量是
 * **DSH 专属**的（`/dsh-plugins/…` 前缀是插件容器给本插件分发的命名空间，不是本包能单独决定的，
 * 见顶层设计 §4.2），于是它独立出来。Host 半边是**免构建的 JS**（`src/host/*.js` 原样发布），
 * 所以它必须是 `.js`——两端都 import 得到，不需要为它再开一个构建产物。
 *
 * 为什么不止两条：抽包时顺手把散落在 `src/host/*.js` 与 `src/client/*.ts` 里的其余各条也收了进来。
 * **行为零变化**，只是把「同一个路径写两遍」这个坑一次填掉。它还有一个直接后果：
 * `src/client/service.ts` 要拿 Pyodide / KaTeX 两条作为配置传给核心包（`createManimRenderer`），
 * 值和 Host 注册的是同一份。
 *
 * 改前缀（改名 / 换命名空间）时**只改 PREFIX 这一行**。
 */

/**
 * 插件容器给本插件分发的命名空间。
 *
 * 与宿主的 `webServer.register` 分发约定一致——**不是本包能单独决定的**，改它要连宿主一起改。
 * 客户端 bundle 注册的 id 是另一回事（由构建预设从 `package.json` 的 name 派生，见 tsdown.preset.ts）。
 */
export const PREFIX = '/dsh-plugins/manim-card'

/** Pyodide 本体与按需包。Client 侧作为 `pyodideIndexURL` 交给核心包（本体的取数根，末尾斜杠由核心包补）。 */
export const PYODIDE_ROUTE = `${PREFIX}/pyodide`

/** KaTeX 静态资源（css + 字体）。Client 侧作为 `katexBaseURL` 交给核心包。 */
export const KATEX_ROUTE = `${PREFIX}/katex`

/** 包清单（GET）与预缓存（POST …/cache，设置页与实验场工具条共用）。 */
export const PACKAGES_ROUTE = `${PREFIX}/packages`

/** 清包缓存（POST；只删本插件缓存目录里的包文件，不递归、不碰别的名字）。 */
export const CACHE_ROUTE = `${PREFIX}/cache`

/** 本机环境探测：`GET` 拿计划，`GET …/<id>` 跑一项。 */
export const ENVIRONMENT_ROUTE = `${PREFIX}/environment`

/** 导出视频：`GET …/ready` 就绪结论、`POST` 真渲染、`POST …/reveal` 在文件浏览器里定位。 */
export const EXPORT_ROUTE = `${PREFIX}/export`
