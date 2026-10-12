# 开发与调试

本页面向本插件的开发者，涵盖源码分层、构建、测试、开发期安装、依赖核心包的方式与排障入口。普通使用者请参阅[安装](/guide/installation)。

## 常用命令

```bash
pnpm build      # tsdown 构建产物（client.js）
pnpm watch      # tsdown --watch
pnpm test       # vitest（不联网的用例）
pnpm test:net   # 联网用例（MANIM_NET=1，超时放宽到 5 分钟）
pnpm gen-skill  # scripts/gen-skill.mjs，生成语料技能
pnpm docs:build # 构建文档站（docs/ 有自己的依赖与 lock）
```

## 源码分层

| 位置 | 是什么 | 构建 |
| --- | --- | --- |
| `src/client/` | 浏览器半边：卡片、实验场、设置面板、跨插件服务 | 打进 `client.js` |
| `src/host/` | 宿主半边：工具注册、资源路由、本机环境探测、导出 | 免构建的普通 JS，原样发布 |
| `src/routes.js` | 两条资源路由的真源（Pyodide / KaTeX） | — |
| `assets/` | 随包资源（pyodide / katex） | 原样发布 |
| `skills/manim-live/` | 给模型的领域技能正文（Markdown） | 原样发布 |
| `docs/` | 文档站（VitePress），与插件的依赖图零关系 | 独立构建 |

本插件只有**一个**构建产物 `client.js`。渲染执行的真本事来自核心包 `manim-live`，由构建预设内联进这个产物；Host 半边不经过 tsdown，直接改写文件即生效。

`src/routes.js` 是两条资源路由的唯一真源：Host 注册路由与 Client 侧传给核心包的取数根都读它。改一处忘另一处的表现是「Pyodide 卡在加载」或「公式变豆腐块」，且只在真机出现——所以 `src/client/service.test.ts` 里对着常量断言，不抄第二遍字面量。

## 测试

单测与源文件同目录（`*.test.ts`），`pnpm test` 跑不联网的那一档。三处值得知道的分工：

- `src/client/service.test.ts` 钉的是**跨插件契约**（服务面形状、两条路由常量、状态必须转发而非重算）；
- `src/client/runtime-status.test.ts` 钉的是**纯选择器**（状态 → 色调、待处理项、可点性），拿假取词函数驱动，不碰 DOM 与渲染结果；
- `src/client/i18n.test.ts` 是**文案缺口回归网**：键名打错或占位符对不上，当场报出是哪个源文件在用。

真运行时的行为（Pyodide、manim 适配、支持面）在核心包自己的套件里，不在本仓。

## 开发期装进宿主

npm 发布与 GitHub 直装两条链路尚未实测（见[安装](/guide/installation)里的提示）。开发期用 **profile 内软链 + `cordis.patch.yml` 条目** 的方式安装：把本仓软链进 `~/.dsh/profiles/desktop/` 的插件目录，并在该 profile 的 `cordis.patch.yml` 里加上本插件一行。之后 HMR 生效，改完代码 `pnpm build` 宿主侧即可热更新。

验证前先**刷新宿主页面**：HMR 对已卸载的槽位（尤其是设置分区）可能不挂回。

## 依赖核心包

核心包以**版本号**依赖（`manim-live: ^0.2.0`），不用本地 `link`，便于随时对齐发布版：

```bash
pnpm add manim-live@latest   # 或在 package.json 改版本号后 pnpm install
pnpm build                    # 重新内联进 client.js
```

若曾用 `pnpm link` 指向本地核心包仓，`node_modules/manim-live` 会是软链，改版本号不会生效——先 `pnpm unlink manim-live` 解链，再 `pnpm install`；`pnpm-lock.yaml` 里应从 `link:../manim-live` 变成具体版本号。

## 排障入口

- **产物加载失败 / `duplicate factory registration`**：先核对客户端 bundle 的注册 id 是否等于包名。它由 `tsdown.preset.ts` 从 `package.json` 派生，不手写。
- **画不出来**：渲染与执行的真本事在核心包 [manim-live](https://github.com/snowowowo/manim-live)（[文档站](https://snowowowo.github.io/manim-live/)），它的排障页与开发页比这里细。先看实验场状态条给出的待处理项——环境类原因都在那里。
- **环境状态读数为空或永远未加载**：检查是否有第二份核心包被引入。状态必须走服务面或本插件这一份的 `manim-live`，见[API 参考](/api/#为什么状态必须走服务面)。
- **公式变豆腐块**：核对 `src/routes.js` 的 KaTeX 路由与 `assets/katex/` 是否齐全。

## 边界与约定

- 语料回归由核心包仓承担（`corpus/`）。本插件实验场只验收自身功能，样例内置在 `src/client/samples.ts`，逐字取自核心包仓的语料文件；换样例去那边挑。
- 约定与规范的唯一来源是容器仓 `dsh-plugins` 的 `AGENTS.md` 与 `.agents/skills/`，本页只做指针。
- 文档站的中英两侧只差语言、不差内容：改了中文必须同步改英文，见 `docs/README.md`。
