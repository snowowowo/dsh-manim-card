// Host 半边（apply 组装）。根目录 index.js 仅 re-export 本模块。
// 五件事：① manim_render 工具——AI 写一段 Manim Python，聊天流出现渲染卡片；
// ② 技能注册——把写法边界与 API 清单讲给模型听（不动手写代码，模型不知道边界在哪）；
// ③ KaTeX 静态资源路由——MathTex 在浏览器里渲染成 KaTeX HTML；
// ④ Pyodide 本体、按需取包、包缓存清单与预缓存——整块在 ./pyodide.js；静态资源那层在 ./assets.js；
// ⑤ 本机环境探测（见 ./environment.js）、导出视频路由（见 ./export.js）与清包缓存——
//   导出走本机 CLI 真渲染出 mp4，落「下载」文件夹。
// 工具返回前先干跑一遍（核心包 `manim-live/node`，与浏览器侧是同一个 Python 运行时）：
// 语法错 / 未定义名 / manim-web 实测缺失项当场回给模型，同一回合自我修正；
// 渲染期错误仍由卡片回显。
// （239 条语料回归网归核心包仓所有，不经本插件。）

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDryRunBridge, runPython } from 'manim-live/node'
import { KATEX_ROUTE } from '../routes.js'
import { assetRoute } from './assets.js'
import { environmentRoute } from './environment.js'
import { exportRoute } from './export.js'
import { clearCacheRoute, installPyodideLoader, packagesRoute, pyodideRoute, resolveCacheDir } from './pyodide.js'

export const name = 'manim-card';
export const inject = ['tools', 'systemPrompt', 'webServer'];

const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const KATEX_DIR = join(PLUGIN_DIR, 'assets', 'katex');
// 全部路由的真源在 src/routes.js——Client 的 fetch 用同一个值，
// 改一边忘一边的 404 从根上堵死。
const KATEX_PATH = KATEX_ROUTE;
const SKILL_DIR = join(PLUGIN_DIR, 'skills', 'manim-card');

const GUIDE = [
  '## Manim 动画（manim_render）使用规范',
  '',
  '你可以在聊天里直接生成 Manim 动画：调用 manim_render，聊天流会出现一张卡片当场渲染播放。',
  '1. 调用前先加载 manim-card 技能——可用 API、不支持项与替代、首选写法都在里面；不要凭记忆发明 API。',
  '2. python 优先写**完整的 Manim Python 文件**（from manim import * + class X(Scene): def construct(self):）；只写 construct 体也收，但完整文件是标准 Manim，读起来迁移起来都一致。',
  '3. 返回 ok:false 时，按 error 里的行号与提示改好**重新调用一次**——不要放弃，也不要让用户自己改代码。',
  '4. 画面由卡片负责，不要用文字复述画面内容；一张卡对应一次调用，要多个画面就多调用几次。',
  '5. **渲染成功后，在回复末尾补一句提醒**（卡片会随一轮的「过程」一起收起，用户可能根本看不到它）：这张动画卡片默认会被折叠收起，想一直看到它，可在「设置 → 工作步骤展示」里选「完全展开」。',
  '6. **一张卡 = 一段独立动画**：要多个画面就多调用几次；连续讲解与旁白不在本工具的范围内。',
].join('\n');

export function apply(ctx) {
  const cacheDir = resolveCacheDir(ctx);
  installPyodideLoader(cacheDir);
  console.info(`[manim-card] Pyodide 包缓存目录：${cacheDir}`);

  // 渲染工具：返回前先干跑一遍。不通过就当场把错误回给模型（同轮自我修正）；
  // 过了才写进会话日志——卡片由 Client 侧折叠出来，渲染期错误由卡片回显。
  ctx.effect(function* () {
    yield ctx.tools.register({
      name: 'manim_render',
      description: '把一段 Manim Python 渲染成聊天流里的动画卡片（进入视口自动播放）。python 优先写完整的 Manim Python 文件（from manim import * + class X(Scene): def construct(self):），只写 construct 体也收；写之前先加载 manim-card 技能。预检不通过时返回 ok:false 与 error，按它修正后重新调用。',
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
  }, 'manim-card tools');

  // 领域技能 = 标准 SKILL.md 文件（读盘注册，改技能就是改 markdown，不动 Host 代码）。
  // 整份正文以内存字符串注册，不设 resourceBase——模型一次调用即拿到全部，无需再去读文件。
  ctx.effect(() => {
    const skills = ctx.get('skills');
    if (!skills) {
      console.error('[manim-card] skills 服务缺席——内嵌技能未注册，AI 将只能依赖工具描述');
      return;
    }
    const raw = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');
    const frontmatter = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const descriptionLine = frontmatter?.[1]?.split('\n').find((line) => line.startsWith('description:'));
    const description = descriptionLine ? descriptionLine.slice('description:'.length).trim() : 'manim_render 的写法边界与可用 API';
    const body = frontmatter ? frontmatter[2] : raw;
    skills.register({
      name: 'manim-card',
      description,
      whenToUse: '调用 manim_render 写 Manim 动画之前（必读）',
      source: 'runtime',
      content: body,
    });
    console.info('[manim-card] 技能 manim-card 已注册');
  }, 'manim-card: skill registration');

  // 常驻小指引：何时调用 + 代码口径。
  ctx.effect(
    () => ctx.systemPrompt.section({ name: 'manim-card:guide', order: 520, text: GUIDE }),
    'manim-card prompt section',
  );

  // KaTeX 静态资源（css + 字体）：MathTex 在浏览器里渲染要用。
  ctx.effect(
    () => ctx.webServer.register(assetRoute(KATEX_DIR, KATEX_PATH)),
    'manim-card: katex assets route',
  );

  // Pyodide 本体与随包件由这里发给 Client；缺的包在这里按需取回并落进用户缓存目录。
  ctx.effect(
    () => ctx.webServer.register(pyodideRoute(cacheDir)),
    'manim-card: pyodide assets route',
  );

  // 设置页那两条：包清单（哪些在本地）与预缓存（先取回来，之后离线可用）。
  ctx.effect(
    () => ctx.webServer.register(packagesRoute(cacheDir)),
    'manim-card: packages route',
  );

  // 本机环境探测：本机的 Manim / FFmpeg / LaTeX 装了没有——导出要走它们，不走 Pyodide。
  ctx.effect(
    () => ctx.webServer.register(environmentRoute()),
    'manim-card: environment route',
  );

  // 导出视频：本机 manim CLI 真渲染出 mp4。就绪结论（GET /ready）与真渲染（POST）都在这条路由里。
  ctx.effect(
    () => ctx.webServer.register(exportRoute()),
    'manim-card: export route',
  );

  // 清包缓存（验「首次取包」那条路要先把本机缓存清干净）。
  ctx.effect(
    () => ctx.webServer.register(clearCacheRoute(cacheDir)),
    'manim-card: cache clear route',
  );
}
