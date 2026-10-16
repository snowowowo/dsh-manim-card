// 本机环境探测的**路由层**：探测本事（查 PATH、跑命令、判三态）在核心包
// `manim-live/node` 的 machine/probe——任何消费者都能用，不必依赖本插件。
//
// 本文件只剩插件自己的事：HTTP 接线（`GET /environment` 拿计划、`GET /environment/<id>` 跑一项）。
// 为什么探测项**分开问**：`manim --version` 要 import 整个 Manim，本机上可能十几秒；
// 一次全跑会把首屏吊死，而且一项超时不该拖累别的项（详见核心包那一处的注释）。

import { probeCheck, probePlan } from 'manim-live/node';
import { ENVIRONMENT_ROUTE } from '../routes.js';
import { sendJson } from './http.js';

const ENVIRONMENT_PATH = ENVIRONMENT_ROUTE;

// 转发给本插件其它半边（export.js 的探测注入）与路由测试——名字与核心包一致。
export { probeCheck, probePlan, resolveExecutable, pythonBesideExecutable } from 'manim-live/node';

/**
 * 环境探测路由（一条前缀路由，看路径尾巴决定干什么）：
 *  - `GET /environment`      → 计划
 *  - `GET /environment/<id>` → 跑那一项
 */
export function environmentRoute() {
  return {
    kind: 'prefix',
    path: ENVIRONMENT_PATH,
    handler: async (request, response) => {
      try {
        if (request.method !== 'GET') {
          response.statusCode = 405;
          response.end();
          return;
        }
        const id = decodeURIComponent(request.url.slice(ENVIRONMENT_PATH.length)).split('?')[0].replace(/^\//u, '');
        if (id === '') {
          sendJson(response, 200, probePlan());
          return;
        }
        const result = await probeCheck(id);
        if (result === null) {
          response.statusCode = 404;
          response.end();
          return;
        }
        sendJson(response, 200, result);
      } catch (error) {
        console.error(`[manim-card] environment route failed (${request.url}):`, error);
        sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
      }
    },
  };
}
