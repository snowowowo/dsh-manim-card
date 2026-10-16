# 开发与调试

本页面向本插件的开发者，涵盖技术栈、目录结构、开发流程、测试与排障入口。只使用插件的读者请看[安装](/guide/installation)与[在聊天里用](/guide/usage)。

## 技术栈

| 层 | 选型 | 要点 |
| --- | --- | --- |
| 语言 | TypeScript 7 | 源码 `.ts` / `.tsx`；`tsconfig.json` 只做类型检查（`noEmit`），产出由 tsdown 负责 |
| 构建 | tsdown + 仓内构建预设 | 产物只有一个 `client.js`；预设是 `tsdown.preset.ts`，每个插件仓自带一份、逐字节相同 |
| UI | React 18（宿主提供） | 写在 `peerDependencies`——**不自带、不锁版本**；宿主基座词在构建时外部化，运行时由宿主解析 |
| 样式 | Tailwind CSS 4 | 构建期经 postcss + lightningcss 生成 CSS，以 `<style data-plugin>` 注入，作用域隔离、不引 preflight |
| 图标 | lucide-react | 具名 import，不整包引入 |
| 代码高亮 | shiki + `@shikijs/langs` | 卡片里查看 Python 源码时使用 |
| 运行时与渲染 | 核心包 `manim-live` `^0.3.0` | 浏览器内的 Python 执行与 WebGL 画布由它提供，构建时**内联**进 `client.js` |
| 测试 | Vitest 5 + v8 覆盖率 | 用例与被测文件同目录，命名 `*.test.ts` |
| 包管理 | pnpm | 唯一 lockfile 是 `pnpm-lock.yaml` |

## 目录结构

```
index.js            宿主入口：只 re-export src/host/index.js，让入口路径与目录布局解耦
client.js           客户端 bundle 产物（构建产出，随包提交）
cordis.patch.yml    本插件在宿主 profile 里的注册条目
src/
├── client/         浏览器半边——全部打进 client.js
│   ├── index.tsx       入口：ModuleLoader 注册 + 槽位接线 + ErrorBoundary
│   ├── renderer.ts     全页唯一的 Manim 渲染器：核心包的工厂在这里接到本插件的路由上
│   ├── settings.tsx    设置面板
│   ├── components/     界面件：卡片、代码视图、状态点、悬浮提示
│   ├── definition.ts   会话折叠定义：一次 manim_card 调用 = 一张渲染卡片
│   ├── render-queue.ts 渲染调度：轮到哪张卡跑、同时活几张画布
│   ├── runtime-status.ts  环境状态 → 展示口径（纯选择器）
│   ├── storage.ts      导出记录落盘（localStorage 当不可信输入读）
│   ├── clipboard.ts    复制源码：clipboard API 优先，execCommand 兜底
│   ├── code-highlight.ts  shiki 的 Python 高亮
│   ├── export.ts       导出接线：把核心包自带的浏览器逐帧导出器接到卡片上
│   ├── environment.ts / packages.ts
│   │                   两个取数层：把核心包的环境探测 / 包管理客户端绑到本插件的路由上
│   ├── i18n.ts         文案字典
│   └── styles.css      皮肤
├── host/           宿主半边——免构建的普通 JS，原样发布
│   ├── index.js        apply 组装：工具注册、资源路由、技能
│   ├── environment.js  本机环境探测（路由仍在，界面不再调它——见下）
│   ├── export.js       本机 CLI 导出（同上）
│   └── pyodide.js / assets.js / http.js   资源与按需取包路由
└── routes.js       全部 HTTP 路由的唯一真源，两侧共用
assets/             随包资源：pyodide / katex
scripts/gen-skill.mjs  生成给模型的领域技能正文
skills/manim-card/  技能正文（Markdown，由上面的脚本生成）
docs/               文档站（VitePress，独立依赖，与插件的依赖图无关）
```

（`*.test.ts` 与被测文件同目录，此处不列。）

本仓只有 **client / host 两个半边**，没有第三块共用区——两侧都要用的常量收在 `src/routes.js`，重量级的共用逻辑（Python 运行时、渲染）归核心包。

`src/routes.js` 是本插件**全部** HTTP 路由的唯一真源：六条常量（KaTeX、Pyodide 两条前缀式文件路由，加上 packages / cache / environment / export 四条接口路由，后四条共八个可数端点）。Host 注册的路径、Client 侧传给核心包的取数根、以及取数层的 fetch 地址全部读它。改一处忘另一处的表现是「Pyodide 卡在加载」或「公式变豆腐块」，且只在真机出现——所以 `src/client/renderer.test.ts` 里对着常量断言，不抄第二遍字面量。

::: info 本机那两条路由为什么还在
导出只走浏览器（`src/client/export.ts` 接核心包自带的 `browserVideo`），本机的 `environment` / `export` 两条路由与 `src/host/environment.js` / `export.js` 已**从界面上撤出**、代码原地保留——理由写在 `src/client/export.ts` 与 `src/client/settings.tsx` 的文件头：换引擎导出会碰上两种实现对同一段代码的语义分歧（已实测 `TracedPath` 一边收物体、一边收取点函数），所以口径是「看到什么，导出什么」。要恢复就把设置页那张卡与 `src/client/environment.ts` 接回来，删代码不是恢复的前提。路由与探测本身仍在 `src/host/routes.test.ts` 的覆盖里。
:::

进包的内容由 `package.json` 的 `files` 决定：`index.js` / `client.js` / `src` / `assets` / `skills` / `cordis.patch.yml`。`docs/` 不进包。

## 搭建开发环境

```bash
git clone https://github.com/snowowowo/dsh-manim-card.git
cd dsh-manim-card
pnpm install
pnpm build       # 产出 client.js
```

装进宿主用 **profile 内软链 + `cordis.patch.yml` 条目**：把本仓软链进 `~/.dsh/profiles/desktop/` 的插件目录，并在该 profile 的 `cordis.patch.yml` 里加上本插件一行（即仓内 `cordis.patch.yml` 的那条 `insert`）。之后 HMR 生效，改完代码在宿主侧即可热更新。

npm 发布与 GitHub 直装两条链路尚未实测，见[安装](/guide/installation)。

## 开发流程

```bash
pnpm watch      # tsdown --watch：改 src/client 即重构建 client.js
pnpm build      # 构建产物 client.js
pnpm test       # vitest（不联网的用例）
pnpm test:net   # 联网用例（MANIM_NET=1，超时放宽到 5 分钟）
pnpm coverage   # 覆盖率（v8，只算 src）
pnpm gen-skill  # scripts/gen-skill.mjs：生成给模型的领域技能
pnpm docs       # 本地起文档站
```

改一处代码走的几步：

1. **先判断改的是哪一半**。`src/client/**` 要重新构建才生效；`src/host/**` 是普通 JS，改完文件即生效，不用 build。
2. client 半边跑 `pnpm watch`（或改完执行一次 `pnpm build`）。
3. **刷新宿主页面**再看结果——HMR 对已卸载的槽位（尤其是设置分区）可能不挂回。
4. `pnpm test`；动到按需取包、真实运行时或联网行为时跑 `pnpm test:net`。
5. 动到包名或入口时，核对客户端 bundle 的**注册 id 仍等于包名**——它由 `tsdown.preset.ts` 从 `package.json` 派生，不手写。

## 测试

单测与源文件同目录（`*.test.ts`），`pnpm test` 跑不联网的那一档。五处值得知道的分工：

- `src/host/routes.test.ts` 用假 ctx 真跑一遍 `apply()`：工具、技能、常驻指引，以及每一条资源与接口路由的注册与行为边界都在这一份里；
- `src/client/renderer.test.ts` 钉的是**渲染器接线**（两条资源地址来自 `src/routes.js`、全页只建一个渲染器）；
- `src/client/runtime-status.test.ts` 钉的是**纯选择器**（状态 → 色调、待处理项、可点性），拿假取词函数驱动，不碰 DOM 与渲染结果；
- `src/client/export.test.ts` 钉的是**导出接线**：按 id 认接入者（不看下标）、`RenderController` 三个成员原样转发、没能力时**不调 run**，以及三种失败各自归到哪个码——拿替身接入者驱动，不碰真实编码；
- `src/client/i18n.test.ts` 是**文案缺口回归网**：键名打错或占位符对不上，当场报出是哪个源文件在用。

真运行时的行为（Pyodide、manim 适配、支持面）在核心包自己的套件里，不在本仓。

## 依赖核心包

核心包以**版本号**依赖（`manim-live: ^0.3.0`），不用本地 `link`，便于随时对齐发布版：

```bash
pnpm add manim-live@latest   # 或在 package.json 改版本号后 pnpm install
pnpm build                    # 重新内联进 client.js
```

若曾用 `pnpm link` 指向本地核心包仓，`node_modules/manim-live` 会是软链，改版本号不会生效——先 `pnpm unlink manim-live` 解链，再 `pnpm install`；`pnpm-lock.yaml` 里应从 `link:../manim-live` 变成具体版本号。

## 排障入口

- **产物加载失败 / `duplicate factory registration`**：先核对客户端 bundle 的注册 id 是否等于包名。它由 `tsdown.preset.ts` 从 `package.json` 派生，不手写。
- **画不出来**：渲染与执行的真本事在核心包 [manim-live](https://github.com/snowowowo/manim-live)（[文档站](https://snowowowo.github.io/manim-live/)），它的排障页与开发页比这里细。环境类原因看设置面板的「浏览器运行时」卡片。
- **环境状态读数为空或永远未加载**：检查是否有第二份核心包被引入。状态必须来自本插件这一份的 `manim-live`——本插件不对外提供 Cordis 服务，没有服务面可走，见[API 参考](/api/#本插件不对外提供-cordis-服务)。
- **公式变豆腐块**：核对 `src/routes.js` 的 KaTeX 路由与 `assets/katex/` 是否齐全。

## 三方分工

从「AI 写代码」到「聊天里看到动画」，链路上有三方，各管一段：

| 参与方 | 负责 | 不负责 |
| --- | --- | --- |
| 宿主 | 会话与聊天流、槽位与服务体系、`manim_card` 的调用与日志 | 渲染、Manim 语法、导出 |
| 核心包 [manim-live](https://snowowowo.github.io/manim-live/) | 浏览器内的 Python 执行、manim 适配层、WebGL 画布、环境状态判定、逐帧导出 | 宿主接入、卡片界面、资源路由 |
| 本插件 | 宿主接入（路由、工具、槽位）、卡片与播放调度、设置面板、导出接线 | 渲染与执行本身 |

与原生 Manim 的差别只有一处需要记住：代码是同一份标准 Manim Python，执行发生在浏览器内的 Pyodide，渲染引擎是 manim-web（不是 CE 的 Cairo 管线），可用面是 Manim CE 的常用子集，覆盖范围与缺失项以核心包[支持面](https://snowowowo.github.io/manim-live/guide/support)为准。

## 边界与约定

- 语料回归由核心包仓承担（`corpus/`）；要挑或加样例，去核心包仓那边。
- 构建预设 `tsdown.preset.ts` 的唯一源是 `dsh-plugin-template` 仓，各插件包逐字节相同；改预设先改模板，再整份复制过来。
- 约定与规范的唯一来源是容器仓 `dsh-plugins` 的 `AGENTS.md` 与 `.agents/skills/`，本页只做指针。
- 文档站的中英两侧只差语言、不差内容：改了中文必须同步改英文，见 `docs/README.md`。
