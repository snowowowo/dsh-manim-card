# Installation

This page covers prerequisites, install commands, bundled assets and network behaviour. For what the plugin is and how it divides work with the core package manim-live, see [What It Is](/en/guide/overview).

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

Pick one (run in the host's CLI / plugin management):

```bash
# From npm (available once published)
dsh plugin add dsh-manim-live

# From a tarball
dsh plugin add ./dsh-manim-live-<version>.tgz

# Direct install from the GitHub repository (repo root is the package)
dsh plugin add github:snowowowo/dsh-manim-live
```

::: tip Not yet verified
The npm publishing and GitHub direct-install paths have not been verified end to end (the repository is currently private). For the development-time setup (symlink + patch entry + HMR), see [Development & Debugging](/en/dev/). This page will be updated once they land.
:::

## Bundled assets

Two runtime assets ship with the plugin, so nothing else has to be prepared and no external CDN is involved:

| Asset | Location | Purpose |
| --- | --- | --- |
| Pyodide distribution | `assets/pyodide/` | Core wasm + standard library + numpy / sympy / mpmath. Basic figures can be drawn offline |
| KaTeX styles and fonts | `assets/katex/` | Needed by formulas typeset with `MathTex` / `Tex` |

Both are served **same-origin** by the plugin's Host routes: the browser side never talks to a public CDN, and the fetch root is the plugin's own route.

## What the first run waits for

Before the first render, the Pyodide core (about 13 MB) and the bundled numpy (about 3 MB) have to be fetched into the browser; during that time the interface shows only a skeleton. That wait can be moved forward:

- press "Warm up now" on the Laboratory status bar, see [Laboratory](/en/guide/lab#environment-status-bar);
- or read the "Python runtime" row in the Settings panel's "Browser runtime" card, which reports the current phase.

## What needs the network, on demand

**Third-party libraries not bundled with the package**, such as `import pandas`: fetched over the network on first use, verified by sha256, and stored in `~/.dsh/cache/manim-live/pyodide/`; afterwards served offline from cache. While fetching, the card shows a "loading X…" hint, and the outcome is also reflected in the package-fetch entry of the environment status.

To prefetch or clear these, go to the "Package cache" block of the Settings panel, see [Settings Panel](/en/guide/settings#package-cache). In an offline environment an uncached library cannot be fetched; rendering then fails with a fetch error whose reason is the same sentence as `packages.lastError` in the environment status.
