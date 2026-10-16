# Installation

This page covers prerequisites, install methods, bundled assets and network behaviour. For what the plugin is and how it divides work with the core package manim-live, see [What It Is](/en/guide/overview); for what to do once it is installed, see [Usage in Chat](/en/guide/usage).

## Prerequisites

| Requirement | Notes |
| --- | --- |
| DeepSeek Harness desktop | The plugin integrates through the host's slot and service systems; it is meaningless outside the host |
| **WebGL** | The canvas renders with three.js; without it no picture can be produced |
| **WebAssembly** | The basis for Pyodide running real CPython; without it no rendering starts at all |
| Local Python | **Not required.** Execution happens in Pyodide inside the browser |

The WebView bundled with the host desktop app satisfies both WebGL and WebAssembly; both probe results are visible directly in the "Browser runtime" card of the Settings panel, see [Settings Panel](/en/guide/settings#browser-runtime).

Only two things touch the local machine, and neither is about rendering:

- **mp4 export**: requires the locally installed `manim` CLI and `ffmpeg`. Whatever is missing is stated plainly by the Settings panel and the export button, see [Usage in Chat](/en/guide/usage#mp4-export).
- **On-demand fetching of third-party Python libraries** (things like `import pandas`): fetched once online on first use, then served offline from cache — see below.

## Install

Pick one in the host's CLI / plugin management:

| Method | Command | Status |
| --- | --- | --- |
| From npm | `dsh plugin add dsh-manim-card` | Not published yet |
| From a tarball | `dsh plugin add ./dsh-manim-card-<version>.tgz` | Use it after a local `npm pack` |
| Direct install from the GitHub repository | `dsh plugin add github:snowowowo/dsh-manim-card` | Repository is public, path not yet verified |

::: tip Two paths not yet verified
The repository is public and the online docs site is live; but the **npm publishing** and **GitHub direct-install** paths have not been verified end to end, and this page will be updated once they land. The development-time setup is a symlink inside the profile plus a patch entry, see [Development & Debugging](/en/dev/).
:::

After installing, refresh the host page: a "manim-card" section appears in the **host settings**.

## Bundled assets

Two kinds of runtime assets ship with the plugin, so nothing else has to be prepared and no external CDN is involved:

| Asset | Location | Purpose |
| --- | --- | --- |
| Pyodide distribution | `assets/pyodide/` | Core wasm + standard library + the numpy / sympy / mpmath wheels. Basic figures can be drawn offline |
| KaTeX styles and fonts | `assets/katex/` | Needed by formulas typeset with `MathTex` / `Tex` |

Both are served **same-origin** by the plugin's Host routes: the browser side never talks to a public CDN, and the fetch root is the plugin's own route.

The plugin's runtime dependency (the core package `manim-live`) is no extra errand either — it is **inlined** into `client.js` at build time, so it needs no separate installation and is not an asset you have to prepare.

## What the first run waits for

Before the first render, the Pyodide core (about 13 MB) and the bundled numpy (about 3 MB) have to be fetched into the browser; during that time the interface shows only a skeleton. You can watch that wait progress:

- read the "Python runtime" row in the Settings panel's "Browser runtime" card, which reports the current phase.

## What needs the network, on demand

**Third-party libraries not bundled with the package**, such as `import pandas`: fetched over the network on first use, verified by sha256, and stored in `~/.dsh/cache/manim-live/pyodide/`; afterwards served offline from cache. While fetching, the card shows a "正在加载 X…" hint; on failure the reason becomes one of the actionable sentences at the foot of the "Browser runtime" card.

To prefetch or clear these, go to the "Package cache" block of the Settings panel, see [Settings Panel](/en/guide/settings#package-cache). In an offline environment an uncached library cannot be fetched; rendering then fails with a fetch error whose reason is the same sentence as `packages.lastError` in the environment status.

## Uninstall

- **Development-time symlink installs**: remove the symlink from the profile and this plugin's line from `cordis.patch.yml`.
- **CLI or marketplace installs**: uninstall through the host's plugin management.

The cache directory `~/.dsh/cache/manim-live/pyodide/` lives outside the plugin directory and is not touched by uninstalling the plugin; delete that directory by hand to reclaim the space.

## Next steps

- Get a first card in a session → [Usage in Chat](/en/guide/usage)
- Check this machine's conditions → [Settings Panel](/en/guide/settings)
