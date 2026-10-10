// 本机环境探测：这台机器上到底有没有 Manim 那套命令行工具链。
//
// 为什么要有它：卡片里的渲染跑在 Pyodide（WebAssembly）里，那是**桥自己的运行时**；
// 而「导出」要调**本机真正装的** Manim 与 FFmpeg——完全是另一套东西。装了没有、版本对不对、
// 命令在哪，只有问这台机器的文件系统与命令行才知道，所以先能一眼看清有什么、缺什么。
//
// 两个刻意的设计：
//  ① 探测项**分开问**（`GET /environment` 拿计划、`GET /environment/<id>` 跑一项）：
//     `manim --version` 要 import 整个 Manim，本机上可能十几秒；一次全跑会把首屏吊死，
//     而且一项超时不该拖累别的项。分开之后界面是逐行亮起来的。
//  ② **不用 shell**：一律 execFile + 写死的参数，用户输入不进命令行，注入无从谈起。

import { execFile } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { sendJson } from './http.js';

const ENVIRONMENT_PATH = '/dsh-plugins/manim-renderer/environment';

/** 单条命令的默认超时；`manim` 要 import 整个 Manim，单独放宽。 */
const DEFAULT_TIMEOUT_MS = 6000;

/**
 * 探测项。`id` 是稳定标识（客户端按它查文案），`tool` 是要在 PATH 里找的可执行文件名。
 * `missingOnFailure` 用于「命令在、但它报告的东西不在」那类：`python3 -c "import manim"`
 * 非零退出就是「没装 manim」，说成「未安装」比说成「出错」准。
 */
const CHECKS = [
  { id: 'python3', tool: 'python3', args: ['-V'] },
  { id: 'manim', tool: 'manim', args: ['--version'], timeoutMs: 20000 },
  { id: 'manimModule', tool: 'python3', args: ['-c', 'import manim; print(manim.__version__)'], timeoutMs: 30000, missingOnFailure: true },
  { id: 'ffmpeg', tool: 'ffmpeg', args: ['-version'] },
  { id: 'latex', tool: 'latex', args: ['--version'] },
  { id: 'dvisvgm', tool: 'dvisvgm', args: ['--version'] },
];

/**
 * 找命令用的 PATH。
 *
 * 桌面应用启动时 PATH 往往是**精简过**的（拿不到登录 shell 那份），于是「明明装了却报没装」
 * 是这类工具最常见的假阴性。所以在这里补上几个常见安装位置：只影响我们找命令，
 * 不改进程环境；同时这份 PATH 会传给子进程，`manim` 起 ffmpeg 时也能找到。
 */
function searchPath() {
  const configured = (process.env.PATH ?? '').split(delimiter).filter((dir) => dir.length > 0);
  if (process.platform === 'win32') return [...new Set(configured)];
  return [...new Set([
    ...configured,
    '/usr/local/bin',
    '/opt/homebrew/bin',
    join(homedir(), '.local', 'bin'),
    '/usr/bin',
    '/bin',
  ])];
}

/** 在 PATH 里找出可执行文件的绝对路径；找不到回 null。 */
export function resolveExecutable(tool) {
  const suffixes = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  for (const dir of searchPath()) {
    for (const suffix of suffixes) {
      const candidate = join(dir, tool + suffix);
      try {
        if (!statSync(candidate).isFile()) continue;
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // 不存在或不可执行：继续找下一个
      }
    }
  }
  return null;
}

/** 跑一条命令，等它结束（不抛、不中断）；超时由 execFile 杀掉进程。 */
function runCommand(file, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(file, args, {
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, PATH: searchPath().join(delimiter) },
    }, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

/** 非空行。 */
function lines(text) {
  return text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
}

/** 版本行：stdout 优先、退 stderr；取第一行非空并限长（有些工具版本串里带一堆构建信息）。 */
function firstLine(...texts) {
  for (const text of texts) {
    const line = lines(text)[0];
    if (line !== undefined) return line.slice(0, 200);
  }
  return '';
}

/** 报错的最后一行——`ModuleNotFoundError: No module named 'manim'` 在那儿，前面都是回溯栈。 */
function lastLine(...texts) {
  for (const text of texts) {
    const line = lines(text).pop();
    if (line !== undefined) return line.slice(0, 200);
  }
  return '';
}

/** 探测计划：有哪些项、各自要找什么、会跑什么命令。**不含探测结果**，所以是秒回的。 */
export function probePlan() {
  return {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    path: searchPath().join(delimiter),
    checks: CHECKS.map((check) => ({
      id: check.id,
      tool: check.tool,
      command: [check.tool, ...check.args].join(' '),
    })),
  };
}

/**
 * 跑一项探测。
 * @returns `{ id, status, path, version, detail }`；`status` 是 `ok` / `missing`（没装）/ `error`（装了但报错）；
 *   `id` 不认识时回 null（调用方答 404）。
 */
export async function probeCheck(id) {
  const check = CHECKS.find((item) => item.id === id);
  if (check === undefined) return null;
  const file = resolveExecutable(check.tool);
  if (file === null) {
    return { id, status: 'missing', path: null, version: '', detail: `PATH 里找不到 ${check.tool}` };
  }
  const timeoutMs = check.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const outcome = await runCommand(file, check.args, timeoutMs);
  if (outcome.error === null) {
    return { id, status: 'ok', path: file, version: firstLine(outcome.stdout, outcome.stderr), detail: '' };
  }
  if (outcome.error.killed === true) {
    return { id, status: 'error', path: file, version: '', detail: `${timeoutMs / 1000} 秒没返回，已放弃` };
  }
  if (check.missingOnFailure === true) {
    return { id, status: 'missing', path: file, version: '', detail: lastLine(outcome.stderr, outcome.stdout) };
  }
  return {
    id,
    status: 'error',
    path: file,
    version: '',
    detail: firstLine(outcome.stderr, outcome.stdout) || outcome.error.message,
  };
}

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
        console.error(`[manim-renderer] environment route failed (${request.url}):`, error);
        sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
      }
    },
  };
}
