// Host 半边（apply 组装）。根目录 index.js 仅 re-export 本模块。
// 五件事：① manim_render 工具——AI 写一段 Manim Python，聊天流出现渲染卡片；
// ② 技能注册——把写法边界与 API 清单讲给模型听（不动手写代码，模型不知道边界在哪）；
// ③ KaTeX 静态资源路由——MathTex 在浏览器里渲染成 KaTeX HTML；
// ④ Pyodide 资源路由 + Node 侧加载——真 CPython(WASM)；随包只带 numpy / sympy，
//    其余包按需从官方发行通道取回、按 lock 的 sha256 校验后落进用户缓存目录
//    （跟随宿主的 dshHomePath，通常是 ~/.dsh/cache/manim-renderer/pyodide）；
// ⑤ 实验场语料路由（GET）+ 清包缓存路由（POST）——语料本体在**包外**的插件仓 `_dev/`
//    （见 ./corpus.js），正式安装里读不到、实验场退化成「自定义代码」。
// 工具返回前先干跑一遍（core.js，与 Client 侧同一个 Python 运行时）：
// 语法错 / 未定义名 / manim-web 实测缺失项当场回给模型，同一回合自我修正；
// 渲染期错误仍由卡片回显。

import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { copyFile, link, mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createDryRunBridge, runPython, setPyodideLoader } from '../../core.js'
import { collectCorpus } from './corpus.js'

export const name = 'manim-renderer';
export const inject = ['tools', 'systemPrompt', 'webServer'];

const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const KATEX_DIR = join(PLUGIN_DIR, 'assets', 'katex');
const KATEX_PATH = '/dsh-plugins/manim-renderer/katex';
const PYODIDE_DIR = join(PLUGIN_DIR, 'assets', 'pyodide');
const PYODIDE_PATH = '/dsh-plugins/manim-renderer/pyodide';
const CORPUS_PATH = '/dsh-plugins/manim-renderer/corpus';
const CACHE_PATH = '/dsh-plugins/manim-renderer/cache';
const SKILL_DIR = join(PLUGIN_DIR, 'skills', 'manim-renderer');
// 随包的 Pyodide 发行版自带 lock：文件名与 sha256 都以它为准，回源校验也用它，不另写一份清单。
const PYODIDE_LOCK = JSON.parse(readFileSync(join(PYODIDE_DIR, 'pyodide-lock.json'), 'utf8'));
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_LOCK.info.version}/full/`;
const MIME = {
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
};

/**
 * 按需 wheel 的落盘位置：用户级缓存，**绝不写进插件目录**（那是随包产物，还可能是软链出去的仓库）。
 *
 * 优先问宿主——`app-boot` 在 ctx 上 provide 了 `dshHomePath`（规则：显式配置 > $DSH_HOME > ~/.dsh），
 * 附件就落在它的 `cache/attachments` 下；这里同样取 `cache/<插件名>`。
 * 用 ctx.get 而不是 inject：inject 在这版 cordis 是硬依赖，服务缺席会让整个插件不加载，而我们只要降级。
 */
function resolveCacheDir(ctx) {
  const dshHomePath = ctx.get('dshHomePath');
  if (typeof dshHomePath === 'function') return join(dshHomePath('cache', 'manim-renderer'), 'pyodide');
  const configured = process.env.DSH_HOME?.trim();
  return join(configured ? resolve(configured) : join(homedir(), '.dsh'), 'cache', 'manim-renderer', 'pyodide');
}

/**
 * 把随包的 wheel 在缓存目录里就位。
 *
 * 为什么需要这一步：`packageCacheDir` 一旦给出，Pyodide 在 Node 侧就**只从那里读**
 * （源码里 `let n = isNode ? config.packageCacheDir : config.indexURL`），不再回看 indexURL。
 * 不先就位的话，连随包的 numpy 都会被当成缺包去 CDN 下（本轮实测：`Didn't find package numpy locally`）。
 * 优先硬链接省一份空间，跨卷时才退回复制。失败不致命——最坏退化成从 CDN 取。
 */
async function seedBundledPackages(cacheDir) {
  let names;
  try {
    names = readdirSync(PYODIDE_DIR).filter((name) => name.endsWith('.whl'));
  } catch (error) {
    console.error('[manim-renderer] 读取随包 wheel 失败：', error);
    return;
  }
  if (names.length === 0) return;
  try {
    await mkdir(cacheDir, { recursive: true });
  } catch (error) {
    console.error(`[manim-renderer] 建缓存目录失败（${cacheDir}）：`, error);
    return;
  }
  for (const name of names) {
    const target = join(cacheDir, name);
    if (existsSync(target)) continue;
    try {
      await link(join(PYODIDE_DIR, name), target);
    } catch {
      try {
        await copyFile(join(PYODIDE_DIR, name), target);
      } catch (error) {
        console.error(`[manim-renderer] 随包件就位失败（${name}）：`, error);
      }
    }
  }
}

/**
 * Host 预检也用真 Python：Node 侧直接从 vendored 目录加载 Pyodide。
 * 用 pathToFileURL + 动态 import，让 pyodide.mjs 留在文件系统上、不进 core.js 产物。
 *
 * ⚠️ packageCacheDir 必须显式给：默认值就是 indexURL，不给时下载的 wheel 会写进随包的
 * assets/pyodide/（本轮真机事故：跑一次按需加载就多出 6 个 whl、约 21 MB）。
 */
function installPyodideLoader(cacheDir) {
  setPyodideLoader(async () => {
    await seedBundledPackages(cacheDir);
    const { loadPyodide } = await import(pathToFileURL(join(PYODIDE_DIR, 'pyodide.mjs')).href);
    return loadPyodide({ indexURL: PYODIDE_DIR, packageCacheDir: cacheDir });
  });
}

const GUIDE = [
  '## Manim 动画（manim_render）使用规范',
  '',
  '你可以在聊天里直接生成 Manim 动画：调用 manim_render，聊天流会出现一张卡片当场渲染播放。',
  '1. 调用前先加载 manim-renderer 技能——可用 API、不支持项与替代、首选写法都在里面；不要凭记忆发明 API。',
  '2. python 优先写**完整的 Manim Python 文件**（from manim import * + class X(Scene): def construct(self):）；只写 construct 体也收，但完整文件是标准 Manim，读起来迁移起来都一致。',
  '3. 返回 ok:false 时，按 error 里的行号与提示改好**重新调用一次**——不要放弃，也不要让用户自己改代码。',
  '4. 画面由卡片负责，不要用文字复述画面内容；一张卡对应一次调用，要多个画面就多调用几次。',
  '5. **渲染成功后，在回复末尾补一句提醒**（卡片会随一轮的「过程」一起收起，用户可能根本看不到它）：这张动画卡片默认会被折叠收起，想一直看到它，可在「设置 → 工作步骤展示」里选「完全展开」。',
].join('\n');

/** 把请求的相对路径解析成 baseDir 下的真实文件；越界或不存在返回 null。 */
function serveAsset(baseDir, relative) {
  const target = normalize(join(baseDir, relative));
  if (!target.startsWith(baseDir + sep)) return null; // 目录越界拒绝
  if (!existsSync(target) || !statSync(target).isFile()) return null;
  return { stream: createReadStream(target), mime: MIME[extname(target)] ?? 'application/octet-stream' };
}

/** 静态资源前缀路由：只放行 GET，路径落在 baseDir 内才给文件。 */
function assetRoute(baseDir, path) {
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

/** 从官方发行通道取一个 wheel/zip，按随包 lock 的 sha256 校验，原子写进缓存目录。 */
async function downloadPackage(fileName, sha256, cacheDir) {
  const response = await fetch(PYODIDE_CDN + fileName);
  if (!response.ok) throw new Error(`下载 ${fileName} 失败：HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== sha256) throw new Error(`下载 ${fileName} 校验不过：期望 ${sha256}，实际 ${actual}`);
  await mkdir(cacheDir, { recursive: true });
  const target = join(cacheDir, fileName);
  // 先写临时名再改名：中途失败不会留下半截文件冒充「已缓存」。
  await writeFile(`${target}.part`, bytes);
  await rename(`${target}.part`, target);
  console.info(`[manim-renderer] 已缓存 ${fileName}（${(bytes.length / 1048576).toFixed(1)} MB）`);
  return bytes;
}

/**
 * Pyodide 资源路由：随包目录 → 缓存目录 → 回源下载。
 *
 * Client 侧 Pyodide 的 indexURL 就是这条路由，所以「本地没有的包」在这里补上：
 * 先查随包目录（Pyodide 本体与 numpy / sympy 这些随包件），再查用户缓存目录，
 * 都没有才从官方发行通道下载、按 lock 的 sha256 校验后落进缓存目录——**磁盘持久，之后离线也命中**。
 * 浏览器只跟本机这条路由打交道，不直连 CDN，所以「缓存到底在哪」是唯一一处、也是用户能看能删的一处。
 */
function pyodideRoute(cacheDir) {
  const digests = new Map(Object.values(PYODIDE_LOCK.packages).map((entry) => [entry.file_name, entry.sha256]));
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
        const digest = name ? digests.get(name) : undefined;
        if (digest === undefined) {
          response.statusCode = 404;
          response.end();
          return;
        }
        // 同一个包只下一次：浏览器可能为同一个文件并发发起多个请求。
        let pending = inflight.get(name);
        if (pending === undefined) {
          pending = downloadPackage(name, digest, cacheDir).finally(() => inflight.delete(name));
          inflight.set(name, pending);
        }
        const bytes = await pending;
        response.setHeader('content-type', MIME[extname(name)] ?? 'application/octet-stream');
        response.end(bytes);
      } catch (error) {
        console.error(`[manim-renderer] pyodide asset failed (${request.url}):`, error);
        response.statusCode = 502;
        response.end();
      }
    },
  };
}

/**
 * 实验场语料路由：把**包外**的开发语料发给浏览器里的实验场。
 *
 * 为什么走路由而不是打进 client.js：这批语料是开发期的回归网（外加讲解模板的出处），
 * 不是产品功能——打进产物等于让每个用户都背上一个只有开发者才用的页面，还平白多几百 KB。
 * 正式安装里 `_dev/` 不存在，`collectCorpus()` 回一份空表，页面据此退化成「自定义代码」那一半。
 * 那是**有意的降级**，所以这里是 200 + 空表，不是 404——404 会在控制台留噪声，还会被当成故障。
 */
function corpusRoute() {
  return {
    kind: 'prefix',
    path: CORPUS_PATH,
    handler: async (request, response) => {
      try {
        if (request.method !== 'GET') {
          response.statusCode = 405;
          response.end();
          return;
        }
        const corpus = collectCorpus();
        response.setHeader('content-type', 'application/json; charset=utf-8');
        // 语料随时在改（开发期），别让浏览器缓存住旧的一份
        response.setHeader('cache-control', 'no-store');
        response.end(JSON.stringify(corpus));
      } catch (error) {
        console.error('[manim-renderer] 读取语料失败：', error);
        response.statusCode = 500;
        response.end();
      }
    },
  };
}

/**
 * 清包缓存：把用户缓存目录里按需取回的 wheel 删掉，好把环境退回「从没缓存过」。
 *
 * 为什么需要它：不清的话「首次取包」这条路只走得到一次，之后全是缓存命中——
 * 想知道首次加载长什么样、提示对不对、断网时说什么，就得能把缓存清掉重来。
 *
 * 尺度：**只删自己缓存目录下、以 .whl 结尾的普通文件**——不递归、不跟随子目录、不碰别的名字。
 * 这是本插件自己的下载缓存（不是用户文档），清它等价于清浏览器缓存；但破坏性仍是破坏性，
 * 所以只由用户显式动作触发（实验场工具条上那个按钮），不自动清、不按大小/时间清。
 * 已经加载进当前页面的包不会被卸载（那在 Pyodide 实例里），要看首次加载得刷新页面。
 */
function clearCacheRoute(cacheDir) {
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
        let names = [];
        try {
          names = readdirSync(cacheDir).filter((name) => name.endsWith('.whl'));
        } catch {
          // 目录还没建过 = 压根没缓存过，按「已清空」处理，不算错
        }
        const removed = [];
        for (const name of names) {
          const target = join(cacheDir, name);
          if (!statSync(target).isFile()) continue;
          try {
            await unlink(target);
            removed.push(name);
          } catch (error) {
            console.error(`[manim-renderer] 清缓存失败（${name}）：`, error);
          }
        }
        console.info(`[manim-renderer] 已清掉包缓存 ${removed.length} 个（${cacheDir}）`);
        response.setHeader('content-type', 'application/json; charset=utf-8');
        response.end(JSON.stringify({ removed }));
      } catch (error) {
        console.error('[manim-renderer] 清缓存失败：', error);
        response.statusCode = 500;
        response.end();
      }
    },
  };
}

export function apply(ctx) {
  const cacheDir = resolveCacheDir(ctx);
  installPyodideLoader(cacheDir);
  console.info(`[manim-renderer] Pyodide 包缓存目录：${cacheDir}`);

  // 渲染工具：返回前先干跑一遍。不通过就当场把错误回给模型（同轮自我修正）；
  // 过了才写进会话日志——卡片由 Client 侧折叠出来，渲染期错误由卡片回显。
  ctx.effect(function* () {
    yield ctx.tools.register({
      name: 'manim_render',
      description: '把一段 Manim Python 渲染成聊天流里的动画卡片（进入视口自动播放）。python 优先写完整的 Manim Python 文件（from manim import * + class X(Scene): def construct(self):），只写 construct 体也收；写之前先加载 manim-renderer 技能。预检不通过时返回 ok:false 与 error，按它修正后重新调用。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['python'],
        properties: {
          python: { type: 'string', description: 'Manim Python 源码（完整 class 外壳，或只写 construct 体内的语句）' },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok'],
          properties: {
            ok: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      execute: async (args) => {
        const python = typeof args?.python === 'string' ? args.python : '';
        if (python.trim().length === 0) return { ok: false, error: 'python 不能为空' };
        // 干跑一遍：语法错、未定义名、manim-web 实测缺失的能力，当场回给模型自我修正。
        try {
          await runPython(python, createDryRunBridge());
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
        return { ok: true };
      },
    });
  }, 'manim-renderer tools');

  // 领域技能 = 标准 SKILL.md 文件（读盘注册，改技能就是改 markdown，不动 Host 代码）。
  // 整份正文以内存字符串注册，不设 resourceBase——模型一次调用即拿到全部，无需再去读文件。
  ctx.effect(() => {
    const skills = ctx.get('skills');
    if (!skills) {
      console.error('[manim-renderer] skills 服务缺席——内嵌技能未注册，AI 将只能依赖工具描述');
      return;
    }
    const raw = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');
    const frontmatter = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const descriptionLine = frontmatter?.[1]?.split('\n').find((line) => line.startsWith('description:'));
    const description = descriptionLine ? descriptionLine.slice('description:'.length).trim() : 'manim_render 的写法边界与可用 API';
    const body = frontmatter ? frontmatter[2] : raw;
    skills.register({
      name: 'manim-renderer',
      description,
      whenToUse: '调用 manim_render 写 Manim 动画之前（必读）',
      source: 'runtime',
      content: body,
    });
    console.info('[manim-renderer] 技能 manim-renderer 已注册');
  }, 'manim-renderer: skill registration');

  // 常驻小指引：何时调用 + 代码口径。
  ctx.effect(
    () => ctx.systemPrompt.section({ name: 'manim-renderer:guide', order: 520, text: GUIDE }),
    'manim-renderer prompt section',
  );

  // KaTeX 静态资源（css + 字体）：MathTex 在浏览器里渲染要用。
  ctx.effect(
    () => ctx.webServer.register(assetRoute(KATEX_DIR, KATEX_PATH)),
    'manim-renderer: katex assets route',
  );

  // Pyodide 本体与随包件由这里发给 Client；缺的包在这里按需取回并落进用户缓存目录。
  ctx.effect(
    () => ctx.webServer.register(pyodideRoute(cacheDir)),
    'manim-renderer: pyodide assets route',
  );

  // 实验场那两条：语料（包外的开发语料，正式安装里是空表）与清包缓存。
  ctx.effect(
    () => ctx.webServer.register(corpusRoute()),
    'manim-renderer: corpus route',
  );
  ctx.effect(
    () => ctx.webServer.register(clearCacheRoute(cacheDir)),
    'manim-renderer: cache clear route',
  );
}
