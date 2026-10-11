# 文档站（VitePress）

给 GitHub Pages 用的静态文档：插件怎么装、在聊天里怎么用、实验场与设置面板、
第三方插件怎么接入 `manim` 服务。

**它与插件的依赖图零关系**——本目录有自己的 `package.json`，依赖只有 `vitepress` 一项；
不在插件的 `files` 白名单里，不进构建产物，`tsconfig.json` 也不覆盖它。

```bash
cd docs
pnpm install     # 只在本目录装一次（本目录自己的 lock 文件）
pnpm dev         # 本地预览 http://localhost:5173/dsh-manim-live/
pnpm build       # 产物在 .vitepress/dist/
```

`base` 配在 `.vitepress/config.ts`（现在是 `/dsh-manim-live/`，与 `snowowowo.github.io/dsh-manim-live/`
的项目页地址对齐）。部署走 `.github/workflows/deploy-docs.yml`：push 到 main 就构建文档站，
探测到 Pages 已开通才部署（私有仓 Pages 未开通时自动跳过，保持绿灯）；仓库转公开、
在仓库设置里把 Pages 的 Source 设为 GitHub Actions 之后，下一个 push 自动上线，工作流不用改。
