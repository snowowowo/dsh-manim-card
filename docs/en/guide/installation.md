# Installation

## Prerequisites

- **DeepSeek Harness desktop** (the plugin integrates through the host's slot / service mechanism; it is meaningless outside the host).
- The browser side needs **WebGL** (the canvas renders with three.js) and **WebAssembly** (Pyodide runs real CPython) — the WebView bundled with the host desktop app satisfies both.
- Basic features **do not require Python installed locally**: execution happens in Pyodide in the browser. Only two features touch the local machine:
  - **mp4 export**: requires locally installed `manim` CLI + `ffmpeg` (whatever is missing is clearly stated by the settings panel and the export button);
  - **On-demand fetching of third-party Python libraries** (things like `import pandas`): fetched over the network once on first use, then served offline from cache — see below.

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
The npm publishing and GitHub direct-install paths have not been verified end to end (the repository is currently private). For the current development-time setup
(symlink + patch entry + HMR), see [Development & Debugging](/en/dev/). This page will be updated once they land.
:::

## Bundled assets — no extra setup

- **The Pyodide distribution ships with the package** (`assets/pyodide/`): core wasm + standard library + numpy / sympy / mpmath — after installing the plugin, basic figures can be drawn even offline.
- **KaTeX styles and fonts ship with the package** (`assets/katex/`): used by `MathTex` formula rendering.
- Both are served same-origin by the plugin's Host routes; no external CDN is involved.

## What needs the network, on demand

**Third-party libraries not bundled with the package**, such as `import pandas`: fetched over the network on first use, verified by sha256, and stored in `~/.dsh/cache/manim-live/pyodide/`; afterwards served offline from cache. While fetching, the card shows a "loading X…" hint. To prefetch or clear these, go to the "Manim 渲染" section of the settings panel — see [Settings Panel](/en/guide/settings).

## Relationship with the core package

The core execution and rendering capabilities (Pyodide runtime, manim adaptation layer, supported surface, canvas) live in the standalone npm package
[manim-live](https://github.com/snowowowo/manim-live) ([docs site](https://snowowowo.github.io/manim-live/));
this plugin handles host integration and asset distribution, and implements the pre-check, playback scheduling, laboratory, and export on top of it.
To use the canvas outside the host, in your own pages, refer directly to the core package's documentation.
