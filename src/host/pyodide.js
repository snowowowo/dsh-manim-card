// Pyodide：本体的静态路由、按需取包，以及给设置页用的「清单 + 预缓存」两条接口。
//
// 供给线的**本事**（lock 目录化、下载校验、缓存盘点、Node 装载）在核心包
// `manim-live/node` 的 `createPyodideSupply`——黑板等其它消费者同样能用，不必依赖本插件。
// 本文件只剩插件自己的两件事：dsh 缓存目录的落位（resolveCacheDir）、把供给线接到
// 本插件的三条 HTTP 路由上（`/pyodide` / `/cache` / `/packages`）。

import { extname, dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { unlink } from 'node:fs/promises'
import { createPyodideSupply, setPyodideLoader } from 'manim-live/node'
import { CACHE_ROUTE, PACKAGES_ROUTE, PYODIDE_ROUTE } from '../routes.js'
import { MIME, serveAsset } from './assets.js'
import { BadRequest, readJsonBody, sendJson } from './http.js'

const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PYODIDE_DIR = join(PLUGIN_DIR, 'assets', 'pyodide');
const PYODIDE_PATH = PYODIDE_ROUTE;
const CACHE_PATH = CACHE_ROUTE;
export const PACKAGES_PATH = PACKAGES_ROUTE;

const supply = createPyodideSupply({ pyodideDir: PYODIDE_DIR });
export { supply };
// 路由测试还在对着目录核不变量（sha256 一个不缺）——真身已在核心包，这里只是转发。
export const CATALOG = supply.catalog;

/**
 * 按需 wheel 的落盘位置：用户级缓存，**绝不写进插件目录**（那是随包产物，还可能是软链出去的仓库）。
 *
 * 优先问宿主——`app-boot` 在 ctx 上 provide 了 `dshHomePath`（规则：显式配置 > $DSH_HOME > ~/.dsh），
 * 附件就落在它的 `cache/attachments` 下；这里同样取 `cache/<插件名>`。
 * 用 ctx.get 而不是 inject：inject 在这版 cordis 是硬依赖，服务缺席会让整个插件不加载，而我们只要降级。
 */
export function resolveCacheDir(ctx) {
  const dshHomePath = ctx.get('dshHomePath');
  if (typeof dshHomePath === 'function') return join(dshHomePath('cache', 'manim-live'), 'pyodide');
  const configured = process.env.DSH_HOME?.trim();
  return join(configured ? resolve(configured) : join(homedir(), '.dsh'), 'cache', 'manim-live', 'pyodide');
}

/** Host 预检装载：加载器由核心包造（本体从随包目录加载、包只认缓存目录），这里只做接线。 */
export function installPyodideLoader(cacheDir) {
  setPyodideLoader(supply.createNodeLoader(cacheDir));
}

/**
 * Pyodide 资源路由：随包目录 → 缓存目录 → 回源下载。
 *
 * Client 侧 Pyodide 的 indexURL 就是这条路由，所以「本地没有的包」在这里补上：
 * 先查随包目录（Pyodide 本体与 numpy / sympy 这些随包件），再查用户缓存目录，
 * 都没有才从官方发行通道下载、按 lock 的 sha256 校验后落进缓存目录——**磁盘持久，之后离线也命中**。
 * 浏览器只跟本机这条路由打交道，不直连 CDN，所以「缓存到底在哪」是唯一一处、也是用户能看能删的一处。
 */
export function pyodideRoute(cacheDir) {
  const inflight = new Map();
  return {
    kind: 'prefix',
    path: PYODIDE_PATH,
    handler: async (request, response) => {
      try {
        if (request.method !== 'GET') {
          response.statusCode = 405;
          response.end();
          return;
        }
        const relative = decodeURIComponent(request.url.slice(PYODIDE_PATH.length)).split('?')[0].replace(/^\//, '');
        // 只认单层文件名：带斜杠的一律不当包处理，越界也就无从谈起。
        const name = relative.includes('/') ? '' : relative;
        const bundled = name ? serveAsset(PYODIDE_DIR, name) : null;
        const file = bundled ?? serveAsset(cacheDir, name);
        if (file) {
          response.setHeader('content-type', file.mime);
          file.stream.pipe(response);
          return;
        }
        const digest = name ? supply.digestOf(name) : undefined;
        if (digest === undefined) {
          response.statusCode = 404;
          response.end();
          return;
        }
        // 同一个包只下一次：浏览器可能为同一个文件并发发起多个请求。
        let pending = inflight.get(name);
        if (pending === undefined) {
          pending = supply.download(name, cacheDir).finally(() => inflight.delete(name));
          inflight.set(name, pending);
        }
        const bytes = await pending;
        response.setHeader('content-type', MIME[extname(name)] ?? 'application/octet-stream');
        response.end(bytes);
      } catch (error) {
        console.error(`[manim-card] pyodide asset failed (${request.url}):`, error);
        response.statusCode = 502;
        response.end();
      }
    },
  };
}

/**
 * 清包缓存：把用户缓存目录里取回来的包删掉，好把环境退回「从没缓存过」。
 *
 * 为什么需要它：不清的话「首次取包」这条路只走得到一次，之后全是缓存命中——
 * 想知道首次加载长什么样、提示对不对、断网时说什么，就得能把缓存清掉重来。
 * 设置页还要**按包清**（某个包想重走一次联网取），所以体里可以给 `names`。
 *
 * 尺度：**只删自己缓存目录下、以 .whl / .zip 结尾的普通文件**——不递归、不跟随子目录、不碰别的名字。
 * 这是本插件自己的下载缓存（不是用户文档），清它等价于清浏览器缓存；但破坏性仍是破坏性，
 * 所以只由用户显式动作触发（设置页某一行 / 清缓存路由），不自动清、不按大小/时间清。
 * 已经加载进当前页面的包不会被卸载（那在 Pyodide 实例里），要看首次加载得刷新页面。
 *
 * 体（可选）：`{ names: ["matplotlib"] }` 只清这几个（名字按归一化对；不在缓存里的静默跳过）；
 * 不给 names 就清掉缓存目录里全部包。两种都回 `{ removed: [文件名…] }`。
 */
export function clearCacheRoute(cacheDir) {
  return {
    kind: 'prefix',
    path: CACHE_PATH,
    handler: async (request, response) => {
      try {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end();
          return;
        }
        const body = await readJsonBody(request);
        const names = Array.isArray(body?.names)
          ? body.names.filter((name) => typeof name === 'string' && name.length > 0)
          : [];
        const targets = names.length === 0 ? supply.cachedFiles(cacheDir) : supply.filesForNames(cacheDir, names);
        const removed = [];
        for (const name of targets) {
          try {
            await unlink(join(cacheDir, name));
            removed.push(name);
          } catch (error) {
            console.error(`[manim-card] 清缓存失败（${name}）：`, error);
          }
        }
        console.info(`[manim-card] 已清掉包缓存 ${removed.length} 个（${cacheDir}）`);
        sendJson(response, 200, { removed });
      } catch (error) {
        // 坏正文是请求的错（400），别报成插件故障
        const bad = error instanceof BadRequest;
        if (!bad) console.error('[manim-card] 清缓存失败：', error);
        sendJson(response, bad ? 400 : 500, { error: error instanceof Error ? error.message : String(error) });
      }
    },
  };
}

/**
 * 设置页那两条接口（同一条前缀路由）：
 *  - `GET  /packages`       → 清单（每个包在本地是什么状态）
 *  - `POST /packages/cache` → 预缓存，体 `{ names: ["matplotlib", …] }`
 *
 * 为什么按包名（`matplotlib`）而不是文件名：用户想的是「我要用 matplotlib」，
 * 文件名（`matplotlib-3.8.4-cp312-cp312-pyodide_2024_0_wasm32.whl`）是实现细节。
 * 文件名的解析与 sha256 都在核心包那一侧做，这里只认包名——也顺带保证**只取 lock 里有的名字**，
 * 这个接口因此不可以被用来下载任意 URL。
 */
export function packagesRoute(cacheDir) {
  return {
    kind: 'prefix',
    path: PACKAGES_PATH,
    handler: async (request, response) => {
      try {
        const action = decodeURIComponent(request.url.slice(PACKAGES_PATH.length)).split('?')[0].replace(/^\//u, '');
        if (action === '') {
          if (request.method !== 'GET') {
            response.statusCode = 405;
            response.end();
            return;
          }
          sendJson(response, 200, supply.inventory(cacheDir));
          return;
        }
        if (action === 'cache') {
          if (request.method !== 'POST') {
            response.statusCode = 405;
            response.end();
            return;
          }
          const body = await readJsonBody(request);
          const names = Array.isArray(body?.names) ? body.names.filter((name) => typeof name === 'string' && name.length > 0) : [];
          if (names.length === 0) {
            sendJson(response, 400, { error: 'names 不能为空' });
            return;
          }
          const results = await supply.cachePackages(cacheDir, names);
          sendJson(response, 200, { results });
          return;
        }
        response.statusCode = 404;
        response.end();
      } catch (error) {
        // 坏正文（截断的 JSON / 超限）是请求的错，答 400 且不吵日志；其余才是路由的真故障。
        const bad = error instanceof BadRequest;
        if (!bad) console.error(`[manim-card] packages route failed (${request.url}):`, error);
        sendJson(response, bad ? 400 : 500, { error: error instanceof Error ? error.message : String(error) });
      }
    },
  };
}
