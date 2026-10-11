# Settings Panel

The "Manim 渲染" section of the host settings answers two questions: **export depends on the local Manim environment**, and **offline availability depends on which packages are cached locally**.

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
