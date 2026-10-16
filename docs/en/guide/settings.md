# Settings Panel

The "Manim Card" section of the Settings panel has two blocks: the browser runtime and the local library list.

| Group / card | Question answered |
| --- | --- |
| Environment → Browser runtime | Can this page produce a picture, can it export video |
| Python libraries | Which third-party libraries are already cached locally |

## Browser runtime

The runtime itself and four browser conditions live in one card, read from the current page.

| Row | Values | Notes |
| --- | --- | --- |
| Python runtime | not loaded / loading / ready / failed | "Not loaded" is the normal initial state — the first render has to fetch the runtime assets first |
| Formula styles | unconfigured / loading / loaded / failed | The stylesheet needed to typeset formulas |
| WebGL | yes / no | The exit for the picture itself; without it the card renders nothing at all |
| WebAssembly | yes / no | The foundation the Python interpreter runs on |
| Browser export | yes / no | Needed to export video (WebCodecs or MediaRecorder); missing it affects export only |

The card header states a count of pending items; when anything is unsatisfied, the card footer lists actionable remedies one by one.

## Python libraries

Lists the eleven commonly used libraries (numpy / sympy / mpmath / matplotlib / pandas / scipy / scikit-learn / statsmodels / networkx / pillow / opencv-python), each row giving state, local size and one action key:

| State | Meaning | Action |
| --- | --- | --- |
| Cached | Already cached locally | Delete |
| Built-in | Bundled with the package | None |
| Not cached | Not cached yet | Cache |

These libraries are fetched over the network on demand at runtime and stored in `~/.dsh/cache/manim-live/pyodide/`. "Cache" here fetches them to the local machine ahead of time so they work offline later; "Delete" removes one from the machine, and it is fetched again the next time it is needed.

The "Cache other libraries" block below the list accepts any package name.
