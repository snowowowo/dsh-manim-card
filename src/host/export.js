// 本机导出的**路由层 + 策略**：导出本事（场景识别 / 就绪门 / 渲染 / 定位）在核心包
// `manim-live/node` 的 createLocalExport——任何消费者都能用，不必依赖本插件。
//
// 本文件只剩插件自己的两件事：
//  ① 策略：成片进用户的「下载」文件夹（核心包默认也是它，这里显式写出来）；
//  ② HTTP 面：`GET /export/ready`（就绪结论，秒回）、`POST /export`（真渲染）、
//     `POST /export/reveal`（在文件浏览器里定位导出的文件）。
// 探测与寻址注入本插件环境那半（./environment.js）：与搬迁前同一份行为，测试可替身。

import { homedir } from 'node:os';
import { join } from 'node:path';
import { createLocalExport } from 'manim-live/node';
import { EXPORT_ROUTE } from '../routes.js';
import { probeCheck, resolveExecutable } from './environment.js';
import { sendJson } from './http.js';

const EXPORT_PATH = EXPORT_ROUTE;

const localExport = createLocalExport({
  probe: (id) => probeCheck(id),
  resolve: resolveExecutable,
  outputDir: join(homedir(), 'Downloads'),
});

// 转发给调用方（路由测试、将来的工具面）——名字与核心包一致。
export const exportReadiness = (options) => localExport.exportReadiness(options);
export const invalidateReadiness = () => localExport.invalidateReadiness();
export const exportVideo = (options) => localExport.exportVideo(options);
export const revealExportedFile = (target, options) => localExport.revealExportedFile(target, options);

/** 读请求体（上限 1 MB——一段 Manim 源码远用不了这么多，超了按坏正文拒）。走异步迭代：真实的 IncomingMessage 与测试替身都吃这一套。 */
async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * 导出路由（一条前缀路由，看路径尾巴决定干什么）：
 *  - `GET  /export/ready`  → 就绪结论（带 TTL 缓存，秒回）；
 *  - `POST /export`        → 真渲染，正文 `{ python, quality? }`；
 *  - `POST /export/reveal` → 在文件浏览器里定位导出好的文件，正文 `{ path, checkOnly? }`。
 */
export function exportRoute() {
  return {
    kind: 'prefix',
    path: EXPORT_PATH,
    handler: async (request, response) => {
      const suffix = request.url.slice(EXPORT_PATH.length).split('?')[0].replace(/^\//u, '');
      try {
        if (request.method === 'GET' && (suffix === '' || suffix === 'ready')) {
          sendJson(response, 200, await exportReadiness());
          return;
        }
        if (request.method === 'POST' && (suffix === '' || suffix === 'reveal')) {
          let body;
          try {
            body = JSON.parse(await readBody(request));
          } catch {
            sendJson(response, 400, { error: '正文不是合法 JSON' });
            return;
          }
          if (suffix === 'reveal') {
            const path = typeof body?.path === 'string' ? body.path : '';
            const checkOnly = body?.checkOnly === true;
            sendJson(response, 200, await revealExportedFile(path, { checkOnly }));
            return;
          }
          const python = typeof body?.python === 'string' ? body.python : '';
          const quality = typeof body?.quality === 'string' ? body.quality : undefined;
          sendJson(response, 200, await exportVideo({ python, quality }));
          return;
        }
        response.statusCode = 405;
        response.end();
      } catch (error) {
        console.error(`[manim-card] export route failed (${request.url}):`, error);
        sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
      }
    },
  };
}
