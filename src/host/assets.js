// 静态资源路由：把插件目录里的文件按扩展名发给浏览器。
//
// 单独一份是因为两条路由（KaTeX 在 ./index.js、Pyodide 在 ./pyodide.js）只有 baseDir 不同，
// 「解析路径 → 越界拒绝 → 发流」这层是同一份：越界检查写两遍，总有一遍会写松。

import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'

export const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  // wasm 必须是 application/wasm，浏览器才会走流式编译（给错会退化成慢路径）
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
  '.whl': 'application/octet-stream',
  // 语料截图（`_dev/shots/<组>/<同名>.png`）：实验场页面直接当 <img> 显示
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** 把请求的相对路径解析成 baseDir 下的真实文件；越界或不存在返回 null。 */
export function serveAsset(baseDir, relative) {
  const target = normalize(join(baseDir, relative));
  if (!target.startsWith(baseDir + sep)) return null; // 目录越界拒绝
  if (!existsSync(target) || !statSync(target).isFile()) return null;
  return { stream: createReadStream(target), mime: MIME[extname(target)] ?? 'application/octet-stream' };
}

/** 静态资源前缀路由：只放行 GET，路径落在 baseDir 内才给文件。 */
export function assetRoute(baseDir, path) {
  return {
    kind: 'prefix',
    path,
    handler: async (request, response) => {
      try {
        if (request.method !== 'GET') {
          response.statusCode = 405;
          response.end();
          return;
        }
        const relative = decodeURIComponent(request.url.slice(path.length));
        const file = serveAsset(baseDir, relative);
        if (!file) {
          response.statusCode = 404;
          response.end();
          return;
        }
        response.setHeader('content-type', file.mime);
        file.stream.pipe(response);
      } catch (error) {
        console.error(`[manim-renderer] asset failed (${path}):`, error);
        response.statusCode = 500;
        response.end();
      }
    },
  };
}
