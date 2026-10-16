# 文档站（VitePress）

给 GitHub Pages 用的静态文档：插件怎么装、在聊天里怎么用、设置面板、
开发与调试，以及模型侧的宿主工具与数据类型的 API 参考。

**它与插件的依赖图零关系**——本目录有自己的 `package.json`，依赖只有 `vitepress` 一项；
不在插件的 `files` 白名单里，不进构建产物，`tsconfig.json` 也不覆盖它。

```bash
cd docs
pnpm install     # 只在本目录装一次（本目录自己的 lock 文件）
pnpm dev         # 本地预览 http://localhost:5173/dsh-manim-card/
pnpm build       # 产物在 .vitepress/dist/
```

`base` 配在 `.vitepress/config.ts`（现在是 `/dsh-manim-card/`，与 `snowowowo.github.io/dsh-manim-card/`
的项目页地址对齐）。部署走 `.github/workflows/deploy-docs.yml`：push 到 main 就构建文档站，
探测到 Pages 已开通才部署（未开通时自动跳过，保持绿灯）；仓库已转公开、Pages 的 Source 已设为
GitHub Actions，下一个 push 自动上线，工作流不用改。

## i18n 约定

- **中文是源语言**，页面在根目录；**英文是本地化**，页面在 `en/` 下，目录结构与中文一一对应。
- `config.ts` 里 `locales.root` = 中文、`locales.en` = 英文（`link: '/en/'`），导航切换由 VitePress
  的 locale 选择器提供；`nav` / `sidebar` / 文案标签按语言各配一份，`socialLinks` 等共享项在顶层 `themeConfig`。
- **两侧只差语言、不差内容**：改了中文必须同步改英文；英文链接指向 `/en/...` 前缀。
- 写法标准源是容器仓 `dsh-plugin-template` 的 `docs/`（含本节同名小节）。
