// 语料的**唯一**位置与读取入口（Host 半边：随包发布，插件运行时要用它把语料发给浏览器）。
//
// 为什么语料在插件仓根的 `_dev/` 而不进发布集：这批文件是**开发期的回归网**（外加讲解模板的出处），
// 不是产品功能——跟着插件发布，等于让每个用户都背上一个只有开发者才用的实验场，
// 还要把上百条源码打进 client.js。所以它留在包外（`package.json` 的 `files` 不含 `_dev`）：
// 只在**仓库检出**里读得到，正式安装里这条路径不存在，实验场自然退化成「自定义代码」。
//
// 解析顺序：环境变量 MANIM_CORPUS（绝对路径）优先，否则 = <插件仓根>/_dev/examples。
// 四处消费者共用本文件，**不许再有第五处**（各写各的路径必然漂移，改一次要记得改四处）：
//   ① src/host/index.js 的语料路由（浏览器侧实验场）——运行时，所以要随包；
//   ② src/core/py/examples.test.ts（Node 回归）——开发期；
//   ③ scripts/gen-skill.mjs（把 lesson 模板内联进技能）——开发期；
//   ④ scripts/shot-corpus.mjs（真浏览器截图落盘）——开发期。
//
// 截图（`_dev/shots/<组>/<同名>.png`）也在这里定路径，理由同上：
//   它是「这条语料**真渲染出来长什么样**」的唯一记录——回归只证明没炸，画面对不对只能看图。
//   存成与 .py 同名同目录，`collectCorpus()` 顺手就能给出每条对应的图，实验场页面直接显示，
//   不必每次现截。同样在包外（`package.json` 的 `files` 不含 `_dev`），正式安装里没有。
//   路径只有 shotPath() 一处定义：Host 的路由、截图脚本、语料字段三边都从它来。
//
// 文件即元数据（写在开头的模块 docstring 里，不影响独立运行）：
//   """画一个圆                  ← 第一行 = 条目标题
//
//   @reject Table                ← 可选：本条应被**当场拒绝**，后面那个词必须出现在报错里
//   @expect 出现一个青色圆…       ← 可选：**预期表现**（一句话，人看得懂就算数）。
//                                  「跑通」只说明没炸；画得对不对要靠这句对着画面核。
//   @browser                     ← 可选：**只能真浏览器跑**（要 DOM / WebGL，如 SVGMobject 的 DOMParser）。
//                                  Node 套件跳过它，改由实验场页面（真浏览器）核。
//   @note 2026-10-09 事故：…      ← 可选：为什么有这条
//   @template 要画带坐标系的函数图…  ← 可选：**标记为技能里的场景模板**，后面那句 = 「什么时候照它抄」。
//                                  解析在本文件（透传成 example.template），消费在 scripts/gen-skill.mjs——
//                                  只有带这条的才进技能模板区。把「入选」与「入选理由」压在同一个标记里，
//                                  是为了堵住「随手把一条塞进模板区」——想说它是模板，就得先说清它代表哪种范式。
//   """
// 目录即分组：<语料根>/<组>/NN-<名字>.py → 分组 <组>、条目 id `<组>-<名字>`（NN- 只用于排序）。
// 分组的中文名与顺序在下面的 GROUPS 里——目录没登记就报错，免得新加的文件夹被静默漏掉。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 本文件所在目录 = <插件仓根>/src/host。 */
const HOST_DIR = dirname(fileURLToPath(import.meta.url));
/** 插件仓根：host → src → 插件仓根。 */
export const REPO_ROOT = join(HOST_DIR, '..', '..');

/** 分组：[id, 显示名, 是否需要联网取包]，顺序即页面上的顺序。 */
export const GROUPS = [
  { id: 'basic', title: '基础几何' },
  { id: 'ctor', title: '构造器参数' },
  { id: 'method', title: '方法与改写' },
  { id: 'graph', title: '坐标系与数据' },
  { id: 'text', title: '文字与公式' },
  { id: 'updater', title: '更新器与轨迹' },
  { id: 'animate', title: '动画' },
  { id: 'scene', title: '场景与分组' },
  { id: 'lesson', title: '讲解场景（模板）' },
  // 按学科的实际讲解场景（下面五组）。与 lesson 的区别：lesson 是**通用范式**（也是技能里的模板），
  // 这五组是**具体知识点**——高数、线代、概率、群论、离散，都是真上课会讲的那一类画面。
  { id: 'math-calculus', title: '高等数学与数学分析' },
  { id: 'math-linear', title: '线性代数' },
  { id: 'math-prob', title: '概率论与统计' },
  { id: 'math-group', title: '群论' },
  { id: 'math-discrete', title: '离散数学' },
  // 语法综合：只用 manim + 标准库（numpy 随包），所以**离线也跑**，默认套件里就有一份。
  { id: 'syntax', title: '语法综合（离线）' },
  // API 覆盖兜底：把三态表里 state=ok 的名字成批点名（颜色 / 速率 / 动画法 / 物体），
  // 一次一条维度钉全。也是离线的。
  { id: 'api', title: 'API 点名（离线）' },
  // 下面两组要真联网取包（首次跑会下载几十 MB），默认不进自动测试；见 examples.test.ts 的 MANIM_NET。
  { id: 'net', title: '第三方包（按需取·需联网）', network: true },
  { id: 'combo', title: '综合场景（多库协同·需联网）', network: true },
  { id: 'reject', title: '应当被当场拒绝' },
];

/** 语料根目录（绝对路径）。目录不存在时返回路径本身，由调用方按「这台机器没有语料」处理。 */
export function corpusRoot() {
  const configured = process.env.MANIM_CORPUS?.trim();
  return configured ? resolve(configured) : join(REPO_ROOT, '_dev', 'examples');
}

/**
 * 截图根目录（绝对路径）：与语料同级，**不是**它的子目录。
 * 特意放在 examples/ 外面——`collectCorpus()` 会把语料根下未登记的目录当配置错误抛错，
 * 截图塞进去就得再给它开一次后门；摆在外面则两边各不相干。
 */
export function shotsRoot() {
  const configured = process.env.MANIM_SHOTS?.trim();
  return configured ? resolve(configured) : join(REPO_ROOT, '_dev', 'shots');
}

/**
 * 一条语料的截图相对路径（相对 shotsRoot()）：同名同目录，只换扩展名。
 * 于是「这条语料的图在哪」不用查表——看文件名就知道，改名也不会漏。
 */
export function shotPath(group, fileName) {
  return `${group}/${fileName.replace(/\.py$/, '.png')}`;
}

/** 语料是否就位（开发机有、正式安装没有）。 */
export function corpusAvailable() {
  return existsSync(corpusRoot());
}

/** 只要目录（不递归进子目录）：一个目录一个分组。 */
const listFiles = (dir) =>
  readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isFile() && name.endsWith('.py'))
    .sort();

/** 解析文件头的模块 docstring：第一行是标题，`@reject` / `@note` 是可选元数据。 */
function readHeader(file, text) {
  const match = text.match(/^"""([\s\S]*?)"""/);
  if (match === null) throw new Error(`${file}：缺少开头的模块 docstring（第一行写标题）`);
  const lines = match[1].split('\n').map((line) => line.trim());
  const title = lines.find((line) => line !== '');
  if (title === undefined) throw new Error(`${file}：docstring 第一行要写标题`);
  let reject = false;
  let errorIncludes;
  let expectation;
  let browser = false;
  let template;
  const notes = [];
  for (const line of lines) {
    if (line.startsWith('@note')) notes.push(line.slice('@note'.length).trim());
    else if (line.startsWith('@expect')) {
      const text = line.slice('@expect'.length).trim();
      if (text !== '') expectation = text;
    } else if (line.startsWith('@browser')) {
      browser = true;
    } else if (line.startsWith('@template')) {
      const text = line.slice('@template'.length).trim();
      if (text !== '') template = text; // 入选理由（「什么时候照它抄」），gen-skill 原样写进技能
    } else if (line.startsWith('@reject')) {
      reject = true;
      const keyword = line.slice('@reject'.length).trim();
      if (keyword !== '') errorIncludes = keyword;
    }
  }
  return { title, notes, reject, errorIncludes, expectation, browser, template };
}

/** 排序前缀 `NN-` 只用于文件排序，不进 id。 */
const idOf = (group, name) => `${group}-${name.replace(/^\d+-/, '').replace(/\.py$/, '')}`;

/** 报错回执里的路径：仓内给仓根相对路径，仓外（MANIM_CORPUS 指过去）给绝对路径。 */
function relativeToRepo(path) {
  const rel = relative(REPO_ROOT, path);
  if (rel.startsWith('..')) return path.split(sep).join('/');
  return rel.split(sep).join('/');
}

/**
 * 读全部语料。目录不存在（正式安装）返回空表，**不抛**——调用方据此走降级。
 * 目录在、分组对不上则**抛**：那是开发机上的配置错误，静默漏掉更糟。
 */
export function collectCorpus() {
  const root = corpusRoot();
  if (!existsSync(root)) return { groups: [], examples: [] };

  const known = new Set(GROUPS.map((group) => group.id));
  const strays = readdirSync(root).filter(
    (name) => statSync(join(root, name)).isDirectory() && !known.has(name),
  );
  if (strays.length > 0) {
    throw new Error(
      `${root} 下有未登记的分组：${strays.join(', ')}——请在 src/host/corpus.js 的 GROUPS 里登记`,
    );
  }

  const groups = [];
  const examples = [];
  for (const group of GROUPS) {
    const dir = join(root, group.id);
    let files;
    try {
      files = listFiles(dir);
    } catch {
      throw new Error(`${group.id}/ 目录不存在（${dir}）——GROUPS 里登记了就得建`);
    }
    if (files.length === 0) throw new Error(`${group.id}/ 里没有 .py`);
    groups.push({ id: group.id, title: group.title, ...(group.network === true ? { network: true } : {}) });
    for (const name of files) {
      const path = join(dir, name);
      const python = readFileSync(path, 'utf8');
      const header = readHeader(`${group.id}/${name}`, python);
      // 上次真渲染的截图。**只在文件真在时才带上这个字段**——页面拿它当 <img> 的地址，
      // 给了地址却 404 会在控制台留噪声，也会被当成故障。
      const shot = shotPath(group.id, name);
      const shotExists = existsSync(join(shotsRoot(), shot));
      examples.push({
        id: idOf(group.id, name),
        group: group.id,
        // 报错回执要按它定位：语料在仓库里就给仓库根相对路径，指到仓库外（MANIM_CORPUS 覆盖）就给绝对路径
        file: relativeToRepo(path),
        title: header.title,
        ...(shotExists ? { shot } : {}),
        expect: header.reject ? 'reject' : 'ok',
        ...(header.errorIncludes === undefined ? {} : { errorIncludes: header.errorIncludes }),
        ...(group.network === true ? { network: true } : {}),
        ...(header.browser ? { browser: true } : {}),
        ...(header.notes.length === 0 ? {} : { note: header.notes.join(' ') }),
        ...(header.expectation === undefined ? {} : { expectation: header.expectation }),
        ...(header.template === undefined ? {} : { template: header.template }),
        python,
      });
    }
  }
  return { groups, examples };
}
