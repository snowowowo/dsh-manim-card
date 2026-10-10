/**
 * Host 与 Client 共用的 HTTP 路由常量——**唯一真源**。
 *
 * 为什么要在 core：同一条路径此前在 Host（注册路由）与 Client（fetch / 拼 <img> 地址）
 * 各写一遍，改一边忘一边就是 404，且 TS 编译器帮不上忙（两边都是普通字符串）。
 * core 是两端共用的那一段（client 打进 bundle、host 走 core.js），常量放这里，
 * 「注册的路由」与「请求的路由」就永远是同一个值。
 *
 * 前缀 `/dsh-plugins/manim-renderer` 是插件容器给本插件分发的命名空间（与宿主的
 * 路由分发约定一致），不是本包能单独决定的——改前缀要连宿主一起改。
 */

/** 实验场语料清单：Host `register` 它，Client `fetch` 它。 */
export const CORPUS_ROUTE = '/dsh-plugins/manim-renderer/corpus'

/** 语料截图静态资源（`assetRoute(shotsRoot(), …)` 的挂载点）。图地址 = `${SHOTS_ROUTE}/${shot}`。 */
export const SHOTS_ROUTE = '/dsh-plugins/manim-renderer/shots'
