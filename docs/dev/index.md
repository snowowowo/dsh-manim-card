# 开发与调试

本页面向本插件的开发者，涵盖构建、测试、开发期安装与排障。普通使用者请参阅[安装](/guide/installation)。

## 常用命令

```bash
pnpm build      # tsdown 构建产物（client.js）
pnpm watch      # tsdown --watch
pnpm test       # vitest（不联网的用例）
pnpm test:net   # 联网用例（MANIM_NET=1，超时放宽到 5 分钟）
pnpm gen-skill  # scripts/gen-skill.mjs，生成语料技能
```

## 开发期装进宿主

npm 发布与 GitHub 直装两条链路尚未实测（见[安装](/guide/installation)里的提示）。当前开发期
用 **profile 内软链 + `cordis.patch.yml` 条目** 的方式安装：把本仓软链进
`~/.dsh/profiles/desktop/` 的插件目录，并在该 profile 的 `cordis.patch.yml` 里加上本插件一行——
之后 HMR 生效，改完代码 `pnpm build` 宿主侧即可热更新。验证前先刷新宿主页面
（HMR 对已卸载槽位可能不挂回）。

## 排障入口

- 产物加载失败 / `duplicate factory registration` 这类症状：先核对客户端 bundle 的注册 id
  是否等于包名（由 `tsdown.preset.ts` 从 `package.json` 派生，不手写）。
- 本插件依赖核心包 [manim-live](https://github.com/snowowowo/manim-live)
  （[文档站](https://snowowowo.github.io/manim-live/)）：渲染执行的真本事在那里，
  排「画不出来」的问题可能要跨到核心包查——它的排障页与开发页比这里细。
- 边界：语料回归由核心包仓承担（`corpus/`）；本插件实验场只验收自身功能，
  样例内置在 `src/client/samples.ts`（逐字取自核心包仓的语料文件，换样例去那边挑）。

约定与规范的唯一来源是容器仓 `dsh-plugins` 的 `AGENTS.md` 与 `.agents/skills/`，本页只做指针。
