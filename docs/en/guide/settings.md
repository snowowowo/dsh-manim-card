# Settings Panel

The "Manim Card" section of the host settings answers two questions — **what rendering needs** and **what export needs** — plus a **Python libraries** block (offline availability depends on which packages are already local). The page is organised as an "Environment" group plus a standalone library list card:

| Group / card | Question answered | Data source |
| --- | --- | --- |
| Environment → Browser runtime | Can this page produce a picture, can it export video in the browser | The current page (the core package's environment status) |
| Python libraries | Which third-party libraries are already local | Host routes + the local cache directory |

Both read the current page or the local cache; **neither has anything to do with a local Manim installation** — rendering and export both happen in the browser, and nothing has to be installed on the machine.

## Browser runtime

The runtime itself and four browser conditions live in one card. It reads from **the current page** rather than through the Host: these things happen in the browser, and the Host cannot see them.

| Row | Values | Notes |
| --- | --- | --- |
| Python runtime | not loaded / loading / ready / failed | "Not loaded" is the normal initial state — the first render has to fetch about 13 MB of core first. On failure the ⓘ holds the original error and the current fetch address |
| Formula styles | unconfigured / loading / loaded / failed | "Unconfigured" means no `katexBaseURL` was passed when creating the renderer; `MathTex` / `Tex` still render, but as bare un-styled typesetting. This plugin always passes one, so only "loaded" or "failed" appears here |
| WebGL | yes / no | The exit for the picture itself; without it the card renders nothing at all |
| WebAssembly | yes / no | The foundation the Python interpreter runs on; without it nothing renders at all |
| Browser export | yes / no | Needed to export a card as a video file (WebCodecs or MediaRecorder); missing it affects export only, never rendering |

The card header states a count of pending items (or "all ready" when nothing is outstanding); when anything is unsatisfied, the card footer lists **actionable remedies** one by one, for instance "the current browser has no usable WebGL: manim-web cannot produce a picture" or "the Pyodide runtime failed to start: … first confirm the fetch address really opens and its files are complete". Those sentences come from the core package under one shared wording.

Value semantics and type definitions of each field are in [Data Types](/en/api/types#environmentstatus).

::: info Export needs no local environment
Export encodes frame by frame in the browser, using the very same engine as the card — which is why there is no "is manim / ffmpeg / LaTeX installed locally" column here: none of that concerns this plugin. The verdict is described in the ⓘ of the "Browser export" row above, and the card's export button reads the same verdict.
:::

## Python libraries

Lists the eleven commonly used libraries (numpy / sympy / mpmath / matplotlib / pandas / scipy / scikit-learn / statsmodels / networkx / pillow / opencv-python), each row being "status dot + name + local size + one action key":

| Status dot | Meaning | Key offered |
| --- | --- | --- |
| Solid green | Cached locally | Delete |
| Solid gray | Bundled with the package | None (shows "built-in") |
| Hollow ring | Not cached | Cache |

Pressing "Cache" on an uncached row fetches that library together with its dependencies.

The wording is "cache" rather than "download": these packages are fetched over the network on demand at runtime anyway (automatically on first `import pandas`, verified by sha256, stored in `~/.dsh/cache/manim-live/pyodide/`); what happens here is **caching to the local machine ahead of time** to guarantee offline availability later. Progress and failure reasons also flow into the environment status: while fetching, the card shows "正在加载 X…", and a failure becomes one of the actionable sentences at the foot of the "Browser runtime" card — the same sentence a failed fetch during rendering reads.

Below the list is a **"Cache other libraries"** card: enter any package name to fetch it (spellings like `Pillow` and `scikit_learn` are both recognized, with completion suggestions while typing); manually fetched packages are kept in the list, and fetching and deleting happen at the same path.
