# Settings Panel

The "Manim 渲染" section of the host settings answers two questions: **what rendering needs** (the browser-side runtime, formula styles, and capabilities) and **what export needs** (the local Manim environment), plus a third block for the **package cache** (offline availability depends on which packages are already local). This page covers all three.

## Browser runtime

The runtime itself and four browser conditions live in one card, read from **the current page** rather than through the Host: these things happen in the browser, and the Host cannot see them.

- **Python runtime**: not loaded / loading / ready / failed. "Not loaded" is the normal initial state — before the first render it downloads ~13 MB of core; on failure the ⓘ shows the original error and the current fetch address.
- **Formula styles**: unconfigured / loading / loaded / failed. Unconfigured means no `katexBaseURL` was passed when creating the renderer; `MathTex` / `Tex` still render, but the formulas come out as bare un-styled typesetting. This plugin always passes one, so the state here is only "loaded" or "failed".
- **WebGL**: the exit for the picture itself; without it the card renders nothing at all.
- **WebAssembly**: the foundation the Python interpreter runs on; without it nothing renders at all.
- **Screen recording**: affects only the "record in the browser" export route; missing it affects neither rendering nor mp4 export.

When anything is unsatisfied, the card header shows a count of pending items and the card footer lists **actionable remedies** one by one (for instance "the current browser has no usable WebGL: manim-web cannot produce a picture", "the Pyodide runtime failed to start: … first confirm the fetch address really opens and its files are complete"). Those sentences come from the core package under one shared wording, so the settings page and the laboratory's status bar say the same thing.

## Local environment

Each of `python3` / `manim` / the manim module / `ffmpeg` / `latex` / `dvisvgm` is probed in turn, each with three states: **ok / missing / error**. Each row shows "name + ⓘ + status dot and version"; what the item is for, where it is probed, and the actual command executed are tucked into the ⓘ (shown on hover or keyboard focus). A "re-detect" action sits at the top.

- Probing **runs only when the user opens the panel**: serially, item by item, each with its own timeout — the machine is not scanned at startup.
- Probing fills in PATH itself: the PATH the desktop host receives is trimmed, and paths like `/usr/local/bin` are often absent from it; without filling in, "installed but not detected" false positives occur.
- The "manim library" item follows the manim command to locate the interpreter: if the command is a symlink into some venv, judging by the first `python3` on PATH would inevitably give a false report.

## Package cache

Lists the eleven commonly used libraries (numpy / sympy / mpmath / matplotlib / pandas / scipy / scikit-learn / statsmodels / networkx / pillow / opencv-python), each row being "status dot + name + local size + one action key":

- solid green = cached, solid gray = bundled with the package, hollow ring = not cached;
- not-cached rows offer a "**Cache**" key (fetches dependencies along with the package); cached rows offer a "**Delete**" key; bundled ones show "built-in" (disabled).

The wording is "cache" rather than "download": these packages are fetched over the network on demand at runtime anyway (automatically on first `import pandas`, verified by sha256, stored in `~/.dsh/cache/manim-live/pyodide/`); what happens here is **caching to the local machine ahead of time** to guarantee offline availability later.

Below the list is a **"Cache other libraries"** card: enter any package name to fetch it (spellings like `Pillow` and `scikit_learn` are both recognized, with completion suggestions while typing); manually fetched packages are kept in the list, and fetching and deleting happen at the same path.
