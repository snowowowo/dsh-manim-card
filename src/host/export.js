// 本机导出：把一段 Manim Python 交给**本机真正装的** Manim CLI，渲染成 mp4 文件。
//
// 与卡片里那条渲染路径的关系：卡片跑在 Pyodide（WebAssembly）里，画在本插件的画布上——
// 看动画够用，但拿不走文件。要一个能保存、能分享的 mp4，就得调用户机器上的 manim 命令，
// 这完全是另一套运行时（见 ./environment.js 头注）。所以导出之前必须先过环境门：
// 必要条件没备齐，这里直接回结构化的「缺什么」，调用方（卡片按钮）据此置灰与提示。
//
// 这个模块是**独立的服务面**，三件事都可以单独被调用，不经过 HTTP 也不经过卡片：
//  - `exportReadiness()`   环境必要条件备齐没有（带 TTL 缓存——`manim --version` 要 import 整个
//                          Manim，好几个秒；聊天流里几十张卡各问一遍不能各跑一遍）；
//  - `exportVideo()`       真正的导出：落临时目录 → manim 渲染 → 把 mp4 拷进「下载」→ 回路径；
//  - `exportRoute()`       上面两件事的 HTTP 面（GET /ready 秒回缓存，POST 真渲染）。
// 后期要对外提供这个服务，也以这一层为界——只依赖本机 CLI 与文件系统，不碰任何 UI。

import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';
import { probeCheck, resolveExecutable } from './environment.js';
import { sendJson } from './http.js';

const EXPORT_PATH = '/dsh-plugins/manim-renderer/export';

/** 导出的环境必要条件。LaTeX / dvisvgm 刻意不在内：只有 MathTex / Tex 写法才用得到，普通动画没有它们照样出片。 */
const REQUIRED_CHECKS = ['python3', 'manim', 'manimModule', 'ffmpeg'];

/** manim 的质量档：l=480p15 m=720p30 h=1080p60 p=1440p60 k=2160p60（`-q` 的合法值）。 */
const QUALITIES = new Set(['l', 'm', 'h', 'p', 'k']);
const DEFAULT_QUALITY = 'h';
/** 导出是真渲染（还可能是 60fps），比卡片那条慢得多；上限放宽到 10 分钟，超时由 execFile 杀进程。 */
const EXPORT_TIMEOUT_MS = 10 * 60 * 1000;
/** 必要条件的就绪结论缓存这么久：太快会反复 import Manim，太慢则装好环境后按钮迟迟不亮。 */
const READINESS_TTL_MS = 30 * 1000;

// ---- 场景代码的处理 ----------------------------------------------------------

/**
 * 从源码里找 Scene 子类的类名（manim 命令行要指名渲染哪个场景）。
 * 认 `class X(<基类>)`，基类是 Scene 本尊、点路径结尾（three_d_scene.Scene）或它的具名子类
 * （ThreeDScene / MovingCameraScene…——名字以 Scene 收尾）；找到多个取第一个。
 */
export function sceneClassName(python) {
  const matches = [...python.matchAll(/^\s*class\s+([A-Za-z_]\w*)\s*\(\s*([A-Za-z_][\w.]*)\s*\)/gmu)];
  const scene = matches.find((match) => /(?:^|\.)\w*Scene$/u.test(match[2]));
  return scene?.[1] ?? null;
}

/** 只写了 construct 体的源码包上标准外壳（与工具侧「只写 construct 体也收」的口径一致）。语句在 construct 里，缩进两层。 */
export function wrapConstructBody(body) {
  const indented = body
    .split('\n')
    .map((line) => (line.trim().length > 0 ? `        ${line}` : line))
    .join('\n');
  return ['from manim import *', '', 'class ManimExportScene(Scene):', '    def construct(self):', indented, ''].join('\n');
}

/** 组装 manim 命令行：一律 execFile + 写死的参数数组，用户源码走临时文件、不进命令行（无注入面）。 */
export function buildRenderArgs(sourceFile, sceneName, quality, mediaDir) {
  return ['-q' + quality, '--media_dir', mediaDir, sourceFile, sceneName];
}

// ---- 就绪门 ------------------------------------------------------------------

let readinessCache = null; // { at: number, value: ExportReadiness }

/**
 * 环境必要条件备齐没有。必要项里任何一项不是 ok 就算没备齐，并带回缺什么（卡片悬停提示直接用）。
 * 可选能力（LaTeX / dvisvgm）也一起测出来放在 `checks` 里，调用方想提示「导公式还需装 LaTeX」有据可依。
 */
export async function exportReadiness({ maxAgeMs = READINESS_TTL_MS } = {}) {
  if (readinessCache !== null && Date.now() - readinessCache.at < maxAgeMs) return readinessCache.value;
  const ids = [...REQUIRED_CHECKS, 'latex', 'dvisvgm'];
  const checks = await Promise.all(ids.map((id) => probeCheck(id)));
  const missing = checks
    .filter((result) => result.status !== 'ok' && REQUIRED_CHECKS.includes(result.id))
    .map((result) => ({ id: result.id, detail: result.detail || (result.status === 'missing' ? '未安装' : '出错') }));
  const value = { ready: missing.length === 0, missing, checks };
  readinessCache = { at: Date.now(), value };
  return value;
}

/** 测试与调用方主动失效缓存（比如设置页刚跑完「重新检测」）。 */
export function invalidateReadiness() {
  readinessCache = null;
}

// ---- 导出 --------------------------------------------------------------------

/** 渲染结果 mp4 的去向：用户的「下载」文件夹。目录确保存在。 */
async function exportDir() {
  const dir = join(homedir(), 'Downloads');
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * 在系统的文件浏览器里定位一个文件（导出成功后点路径就走这里）。
 *
 * 为什么只认导出目录里的文件：这个动作会**代替用户去操作系统**，路径又是从页面来的。
 * 放开就等于给了一条「随便指个路径就替你打开」的通路。限定在导出目录（「下载」）之内，
 * 越界的一律拒绝——协议上多做一步，攻击面就归零。
 *
 * @param run 跑命令的注入点：测试要断言「点了什么命令」，又绝不能真弹出 Finder。
 */
export async function revealExportedFile(target, { run = runCommand } = {}) {
  if (typeof target !== 'string' || target.length === 0) return { ok: false, error: '路径为空' };
  const dir = await exportDir();
  let inside = null;
  let real = null;
  try {
    // 两边都先解掉软链再比（macOS 上 /var 就是 /private/var 的软链，不解析会误判越界）
    real = await realpath(target);
    inside = await realpath(dir);
  } catch {
    return { ok: false, error: '文件不在了（可能已被移走或删掉）' };
  }
  if (real !== inside && !real.startsWith(inside + sep)) {
    return { ok: false, error: '只能打开导出目录里的文件' };
  }
  // macOS 用 open -R 选中文件；Windows 用 explorer /select,；Linux 没有「选中」这回事，开所在目录
  const [file, args] = process.platform === 'darwin'
    ? ['open', ['-R', real]]
    : process.platform === 'win32'
      ? ['explorer', [`/select,${real}`]]
      : ['xdg-open', [dirname(real)]];
  const outcome = await run(file, args, 10_000);
  if (outcome.error !== null) {
    return { ok: false, error: tail(outcome.stderr) || outcome.error.message };
  }
  return { ok: true };
}

/** 跑一条命令等它结束；超时 / 非零退出都不抛，由调用方看 outcome。 */
function runCommand(file, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(file, args, {
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

/** 命令报错里最值钱的是最后几行（manim 的异常栈顶在那儿），前面的进度条噪声裁掉。 */
function tail(text, keep = 6) {
  const lines = String(text).split('\n').map((line) => line.trimEnd()).filter((line) => line.trim().length > 0);
  return lines.slice(-keep).join('\n').slice(0, 2000);
}

/**
 * manim 分段渲染的碎片目录。开着缓存（默认）时它会在成片旁边留下**每一段动画**的小 mp4，
 * 成片则是同一层那个 `<场景名>.mp4`。挑选产物时必须把碎片排除掉——踩过一次：
 * 按路径排序取「最后一个」，而 `partial_movie_files`（小写 p）排在 `SecantToTangent.mp4`
 * （大写 S）之后，于是导出的是一段一秒的碎片，用户看到的是「动画不完整」。
 */
const PARTIAL_DIR = 'partial_movie_files';

/**
 * 递归找 mp4。`includePartial` 只给报错信息用：成片找不到时，要能说清
 * 「是碎片还在但没拼成片」还是「压根没产出」，这两件事用户能做的事不一样。
 */
async function findVideos(root, { includePartial = false } = {}) {
  const found = [];
  const walk = async (dir) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!includePartial && entry.name === PARTIAL_DIR) continue;
        await walk(path);
      } else if (entry.isFile() && entry.name.endsWith('.mp4')) found.push(path);
    }
  };
  await walk(root);
  return found;
}

/**
 * 从候选里挑成片：名字就是场景名的那份优先；实在认不出（用户自己改了输出名之类），
 * 退而取**最大**的那个——manim 的正片永远比任何单段碎片大。
 */
function pickFinalVideo(candidates, sceneName) {
  const named = candidates.find((path) => basename(path) === `${sceneName}.mp4`);
  if (named !== undefined) return named;
  let best = candidates[0];
  let bestSize = -1;
  for (const path of candidates) {
    try {
      const size = statSync(path).size;
      if (size > bestSize) {
        bestSize = size;
        best = path;
      }
    } catch {
      // 读不到大小就跳过（清理当中/权限问题），别的候选继续
    }
  }
  return best;
}

/**
 * 导出一段 Manim Python 为 mp4。
 * @param workRoot 暂存根目录（缺省系统临时目录）。源码与 manim 的 media 都落在它下面的
 *   一次性目录里，渲染完只把 mp4 拷走、整目录删掉。可注入是为了**测试能确定地断言清理**——
 *   断言全局临时目录会跟任何同时在跑的导出（比如开发时手工验收）撞车。
 * @returns `{ ok: true, file, quality }` 或 `{ ok: false, reason, error?, missing? }`；
 *   `reason`：`input`（源码为空）/ `environment`（必要条件没备齐）/ `render`（manim 跑了但失败）。
 */
export async function exportVideo({ python, quality = DEFAULT_QUALITY, timeoutMs = EXPORT_TIMEOUT_MS, workRoot = tmpdir() } = {}) {
  if (typeof python !== 'string' || python.trim().length === 0) {
    return { ok: false, reason: 'input', error: 'python 不能为空' };
  }
  const q = QUALITIES.has(quality) ? quality : DEFAULT_QUALITY;

  const readiness = await exportReadiness();
  if (!readiness.ready) {
    return { ok: false, reason: 'environment', missing: readiness.missing, error: '本机环境没有备齐，无法导出' };
  }

  const manimPath = resolveExecutable('manim');
  if (manimPath === null) {
    // 刚刚的 readiness 还说 ready——只可能被并发清了缓存之类，按环境问题回
    return { ok: false, reason: 'environment', missing: [{ id: 'manim', detail: 'PATH 里找不到 manim' }], error: 'PATH 里找不到 manim' };
  }

  const sceneName = sceneClassName(python);
  const source = sceneName === null ? wrapConstructBody(python) : python;
  const className = sceneName ?? 'ManimExportScene';

  // 临时工作目录：源码与 media 都落在这里，渲染完只把 mp4 拷走，整目录删掉
  const workDir = await mkdtemp(join(workRoot, 'manim-export-'));
  const mediaDir = join(workDir, 'media');
  const sourceFile = join(workDir, 'scene.py');
  await writeFile(sourceFile, source, 'utf8');
  try {
    const outcome = await runCommand(manimPath, buildRenderArgs(sourceFile, className, q, mediaDir), timeoutMs);
    if (outcome.error !== null) {
      const detail = outcome.error.killed === true
        ? `${Math.round(timeoutMs / 60000)} 分钟没渲染完，已放弃`
        : tail(outcome.stderr, outcome.stdout) || outcome.error.message;
      return { ok: false, reason: 'render', error: detail };
    }
    const videos = await findVideos(mediaDir);
    if (videos.length === 0) {
      const partials = await findVideos(mediaDir, { includePartial: true });
      return {
        ok: false,
        reason: 'render',
        error: partials.length > 0
          ? `manim 只留下了 ${partials.length} 段渲染碎片，没有拼成成片`
          : 'manim 跑完了，但没有产出视频文件',
      };
    }
    // 成片优先，绝不拿碎片充数（碎片目录已在 findVideos 里排除）
    const produced = pickFinalVideo(videos, className);
    const stamp = new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '');
    const target = join(await exportDir(), `manim-${className}-${stamp}.mp4`);
    await copyFile(produced, target);
    return { ok: true, file: target, quality: q };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---- HTTP 面 -----------------------------------------------------------------

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
 *  - `POST /export/reveal` → 在文件浏览器里定位导出好的文件，正文 `{ path }`。
 * 就绪结论也顺带把「设置页刚检测过」的缓存失效做在 `invalidateReadiness` 上，由调用方按需调。
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
            sendJson(response, 200, await revealExportedFile(path));
            return;
          }
          const python = typeof body?.python === 'string' ? body.python : '';
          const quality = typeof body?.quality === 'string' ? body.quality : DEFAULT_QUALITY;
          sendJson(response, 200, await exportVideo({ python, quality }));
          return;
        }
        response.statusCode = 405;
        response.end();
      } catch (error) {
        console.error(`[manim-renderer] export route failed (${request.url}):`, error);
        sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
      }
    },
  };
}
