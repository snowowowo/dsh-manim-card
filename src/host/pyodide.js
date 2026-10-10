// Pyodide：本体的静态路由、按需取包，以及给设置页用的「清单 + 预缓存」两条接口。
//
// 三件事都围着同一个目录转（`<dsh home>/cache/manim-live/pyodide`），所以放一个文件里：
//   ① `/pyodide` 静态路由——随包目录 → 缓存目录 → 回源下载（按 lock 的 sha256 校验）；
//   ② `/cache` 清缓存——只删自己缓存目录里的包文件（实验场验「首次取包」要用）；
//   ③ `/packages` 清单与预缓存——设置页看得到哪些包在本地、能提前取回来（之后离线可用）。
//
// 随包只带 numpy / sympy，其余包按需从官方发行通道取回；文件名与 sha256 一律以随包的
// pyodide-lock.json 为准，不另写一份清单——两份清单早晚会对不上。

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { copyFile, link, mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { setPyodideLoader, canonicalPackageName } from 'manim-live/node'
import { CACHE_ROUTE, PACKAGES_ROUTE, PYODIDE_ROUTE } from '../routes.js'
import { MIME, serveAsset } from './assets.js'
import { BadRequest, readJsonBody, sendJson } from './http.js'

const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PYODIDE_DIR = join(PLUGIN_DIR, 'assets', 'pyodide');
const PYODIDE_PATH = PYODIDE_ROUTE;
const CACHE_PATH = CACHE_ROUTE;
export const PACKAGES_PATH = PACKAGES_ROUTE;

const PYODIDE_LOCK = JSON.parse(readFileSync(join(PYODIDE_DIR, 'pyodide-lock.json'), 'utf8'));
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_LOCK.info.version}/full/`;
/** 文件名 → sha256（回源校验用）。lock 是静态的，建一次就够。 */
const DIGESTS = new Map(Object.values(PYODIDE_LOCK.packages).map((entry) => [entry.file_name, entry.sha256]));

/**
 * 可以从官方通道取回的条目：有 `.whl` / `.zip` 产物的那些。
 *
 * 为什么不是「全部 lock 条目」：`*-tests` 的产物是 `.tar`（不装进运行时），
 * 被后缀天然滤掉；而 `cpython_module`（`hashlib` 之类）确实是独立的 whl，
 * 用户代码 `import hashlib` 时 Pyodide 会去取它——所以保留，别自作主张当「内置」。
 *
 * **名字用 lock 的键**（不是条目里的 `name` 字段）：两者有 21 条不一致（键 `pillow` /
 * 字段 `Pillow`），而 `depends` 里两种写法都出现。键是 Pyodide 自己的标识，
 * 也让「用户输入的名字」有个唯一落点。
 *
 * **`sha256` 必须带上**：这条记录就是「把这个包取回来」所需的全部信息。曾经漏了它，
 * 下载校验拿到的期望值恒为 `undefined`，于是**每一次预缓存都必然失败**、报错还只说
 * 「期望 undefined」（测试也没拦下：当时只有「摘要对不上要报错」的用例，没有「对得上要成功」的）。
 */
const DOWNLOADABLE = Object.entries(PYODIDE_LOCK.packages)
  .filter(([, entry]) => typeof entry.file_name === 'string' && /\.(whl|zip)$/u.test(entry.file_name));

/**
 * 归一化名 → lock 键。依赖引用与用户输入都先过这里，再落到目录里的 `name` 上。
 * 归一化规则见核心包 `manim-live/node` 的 `canonicalPackageName`（两端同一份），原因也写在那一处。
 */
const KEY_BY_CANONICAL = new Map(DOWNLOADABLE.map(([key]) => [canonicalPackageName(key), key]));

const CATALOG = DOWNLOADABLE
  .map(([key, entry]) => ({
    name: key,
    version: typeof entry.version === 'string' ? entry.version : '',
    fileName: entry.file_name,
    kind: entry.package_type ?? 'package',
    // 依赖先归一化再落成**键**，解析不到的直接丢掉：发出去的都是能取的，
    // 客户端那边才算得准闭包（原来按字段名发，matplotlib 的 `pillow` 会对不上而漏掉）。
    depends: (Array.isArray(entry.depends) ? entry.depends : [])
      .map((ref) => KEY_BY_CANONICAL.get(canonicalPackageName(ref)))
      .filter((ref) => typeof ref === 'string'),
    imports: Array.isArray(entry.imports) ? entry.imports : [],
    sha256: typeof entry.sha256 === 'string' ? entry.sha256 : '',
  }))
  .sort((left, right) => left.name.localeCompare(right.name));
export { CATALOG };
const CATALOG_BY_NAME = new Map(CATALOG.map((entry) => [canonicalPackageName(entry.name), entry]));

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
    console.error('[manim-live] 读取随包 wheel 失败：', error);
    return;
  }
  if (names.length === 0) return;
  try {
    await mkdir(cacheDir, { recursive: true });
  } catch (error) {
    console.error(`[manim-live] 建缓存目录失败（${cacheDir}）：`, error);
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
        console.error(`[manim-live] 随包件就位失败（${name}）：`, error);
      }
    }
  }
}

/**
 * Host 预检也用真 Python：Node 侧直接从 vendored 目录加载 Pyodide。
 * 用 pathToFileURL + 动态 import，让 pyodide.mjs 留在文件系统上、不进任何产物。
 *
 * ⚠️ packageCacheDir 必须显式给：默认值就是 indexURL，不给时下载的 wheel 会写进随包的
 * assets/pyodide/（本轮真机事故：跑一次按需加载就多出 6 个 whl、约 21 MB）。
 */
export function installPyodideLoader(cacheDir) {
  setPyodideLoader(async () => {
    await seedBundledPackages(cacheDir);
    const { loadPyodide } = await import(pathToFileURL(join(PYODIDE_DIR, 'pyodide.mjs')).href);
    return loadPyodide({ indexURL: PYODIDE_DIR, packageCacheDir: cacheDir });
  });
}

/** 从官方发行通道取一个 wheel/zip，按随包 lock 的 sha256 校验，原子写进缓存目录。 */
async function downloadPackage(fileName, sha256, cacheDir) {
  // 没有期望摘要就**不下**：`undefined` 会让 `actual !== sha256` 恒成立，白白下一遍再报一句
  // 看不懂的「期望 undefined」——宁可在发请求之前就停下，把话说清楚。
  if (typeof sha256 !== 'string' || sha256.length === 0) throw new Error(`没有 ${fileName} 的 sha256，拒绝下载`);
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
  console.info(`[manim-live] 已缓存 ${fileName}（${(bytes.length / 1048576).toFixed(1)} MB）`);
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
        const digest = name ? DIGESTS.get(name) : undefined;
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
        console.error(`[manim-live] pyodide asset failed (${request.url}):`, error);
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
 * 所以只由用户显式动作触发（实验场工具条 / 设置页某一行），不自动清、不按大小/时间清。
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
        const targets = names.length === 0 ? cachedPackageFiles(cacheDir) : cachedFilesFor(cacheDir, names);
        const removed = [];
        for (const name of targets) {
          try {
            await unlink(join(cacheDir, name));
            removed.push(name);
          } catch (error) {
            console.error(`[manim-live] 清缓存失败（${name}）：`, error);
          }
        }
        console.info(`[manim-live] 已清掉包缓存 ${removed.length} 个（${cacheDir}）`);
        sendJson(response, 200, { removed });
      } catch (error) {
        // 坏正文是请求的错（400），别报成插件故障
        const bad = error instanceof BadRequest;
        if (!bad) console.error('[manim-live] 清缓存失败：', error);
        sendJson(response, bad ? 400 : 500, { error: error instanceof Error ? error.message : String(error) });
      }
    },
  };
}

/** 缓存目录里现有的包文件（只看 `.whl` / `.zip`、只认普通文件）。目录没建过 = 没缓存过，回空表。 */
function cachedPackageFiles(cacheDir) {
  let names;
  try {
    names = readdirSync(cacheDir);
  } catch {
    return [];
  }
  const files = [];
  for (const name of names) {
    if (!/\.(whl|zip)$/u.test(name)) continue;
    try {
      if (statSync(join(cacheDir, name)).isFile()) files.push(name);
    } catch {
      // 期间被别人删了，当没有
    }
  }
  return files;
}

/** 按包名挑出缓存目录里的文件：不在缓存里的、名字对不上的都静默跳过。 */
function cachedFilesFor(cacheDir, names) {
  const present = new Set(cachedPackageFiles(cacheDir));
  const targets = new Set();
  for (const name of names) {
    const entry = CATALOG_BY_NAME.get(canonicalPackageName(name));
    if (entry !== undefined && present.has(entry.fileName)) targets.add(entry.fileName);
  }
  return [...targets];
}

/** 缓存目录现状：文件名 → 字节数。目录不存在时回空表（= 还没缓存过，不是错）。 */
function readCacheFiles(cacheDir) {
  const sizes = new Map();
  let names;
  try {
    names = readdirSync(cacheDir);
  } catch {
    return sizes;
  }
  for (const name of names) {
    try {
      const stat = statSync(join(cacheDir, name));
      if (stat.isFile()) sizes.set(name, stat.size);
    } catch (error) {
      console.error(`[manim-live] 读缓存文件失败（${name}）：`, error);
    }
  }
  return sizes;
}

/** 随包目录里的文件名集合（只用来判断「这个包是不是跟着插件来的」）。 */
function readBundledNames() {
  try {
    return new Set(readdirSync(PYODIDE_DIR));
  } catch (error) {
    console.error('[manim-live] 读随包目录失败：', error);
    return new Set();
  }
}

/**
 * 一个包在本地的状态：`bundled` 随包来 / `cached` 本机取回来的 / `absent` 要用就得联网。
 *
 * 判定顺序不能反：随包的 wheel 会被 `seedBundledPackages` 硬链接进缓存目录，
 * 先看缓存就会把随包件算成「用户缓存」，于是「已缓存几个」这个数一开始就是虚的。
 */
function stateOf(fileName, bundled, cached) {
  if (bundled.has(fileName)) return 'bundled';
  if (cached.has(fileName)) return 'cached';
  return 'absent';
}

/** 设置页要看的清单：每个可下载的包，现在在本地是什么状态、占多少字节。 */
export function packageInventory(cacheDir) {
  const cached = readCacheFiles(cacheDir);
  const bundled = readBundledNames();
  return {
    cacheDir,
    pyodideVersion: typeof PYODIDE_LOCK.info?.version === 'string' ? PYODIDE_LOCK.info.version : '',
    entries: CATALOG.map((entry) => ({
      ...entry,
      state: stateOf(entry.fileName, bundled, cached),
      bytes: cached.get(entry.fileName) ?? null,
    })),
  };
}

/**
 * 把给定的包取到本地缓存。**顺序取、失败即停**——一个失败多半是网络或磁盘的系统性问题，
 * 继续往下只会把同一个错重复 N 遍，还把界面吊在那儿。
 * 每个包都按 lock 的 sha256 校验（见 downloadPackage），已经在本地的直接跳过、不重下。
 * @returns 每个包的结果：取完的状态、是否真的下了、字节数；失败带 `error`。
 */
async function cachePackages(cacheDir, names, bundled, cached) {
  const results = [];
  for (const name of names) {
    // 名字按归一化对（`Pillow` / `scikit_learn` 这类写法都落到同一个包上），
    // 回执里用目录里的名字，好和清单对上。
    const entry = CATALOG_BY_NAME.get(canonicalPackageName(name));
    if (entry === undefined) {
      results.push({ name, state: 'unknown', downloaded: false, error: '这个包不在随包 lock 里' });
      break;
    }
    const state = stateOf(entry.fileName, bundled, cached);
    if (state !== 'absent') {
      results.push({ name: entry.name, state, downloaded: false, bytes: cached.get(entry.fileName) ?? 0 });
      continue;
    }
    try {
      const bytes = await downloadPackage(entry.fileName, entry.sha256, cacheDir);
      results.push({ name, state: 'cached', downloaded: true, bytes: bytes.length });
    } catch (error) {
      console.error(`[manim-live] 预缓存 ${name} 失败：`, error);
      results.push({ name, state: 'absent', downloaded: false, error: error instanceof Error ? error.message : String(error) });
      break;
    }
  }
  return results;
}

/**
 * 设置页那两条接口（同一条前缀路由）：
 *  - `GET  /packages`       → 清单（每个包在本地是什么状态）
 *  - `POST /packages/cache` → 预缓存，体 `{ names: ["matplotlib", …] }`
 *
 * 为什么按包名（`matplotlib`）而不是文件名：用户想的是「我要用 matplotlib」，
 * 文件名（`matplotlib-3.8.4-cp312-cp312-pyodide_2024_0_wasm32.whl`）是实现细节。
 * 文件名的解析与 sha256 都在这里做，客户端只认包名——也顺带保证**只取 lock 里有的名字**，
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
          sendJson(response, 200, packageInventory(cacheDir));
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
          const results = await cachePackages(cacheDir, names, readBundledNames(), readCacheFiles(cacheDir));
          sendJson(response, 200, { results });
          return;
        }
        response.statusCode = 404;
        response.end();
      } catch (error) {
        // 坏正文（截断的 JSON / 超限）是请求的错，答 400 且不吵日志；其余才是路由的真故障。
        const bad = error instanceof BadRequest;
        if (!bad) console.error(`[manim-live] packages route failed (${request.url}):`, error);
        sendJson(response, bad ? 400 : 500, { error: error instanceof Error ? error.message : String(error) });
      }
    },
  };
}
