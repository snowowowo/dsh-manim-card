# Laboratory

The Laboratory lives in the "Manim 渲染" page of the left navigation. It is the acceptance bench for this plugin's features: card rendering, playback control, code viewing, mp4 export and precheck errors are all verified here against expectations. This page covers its interface, environment status bar, sample mode, toolbar and progress persistence.

The Laboratory is not a separately implemented debug page — **the canvas uses the same component as the chat cards**, so manual playback, code viewing and export behave exactly as in chat, and what passes here holds there too.

The samples are a **built-in** small set (bundled into the plugin, available in regular installations too). The 239-entry corpus regression suite belongs to the core package [manim-live](https://github.com/snowowowo/manim-live) repository (`corpus/`); this plugin maintains no corpus.

## Interface

- The sample list sits on the left and the render preview on the right: click any entry to render it, and pass / fail status is marked on the entry immediately.
- The top of the page offers two modes: **Samples** and **Custom code** (write and run a free-form piece of Python).
- A permanent environment status bar sits below the page header, see below.

## Environment status bar

The status bar answers one question: **what is this machine still missing**. It puts "can it render" and "can it export mp4" side by side as four chips:

| Chip | Covers | Values |
| --- | --- | --- |
| Local Manim | The local toolchain that mp4 export goes through | checking / ready / N missing / unknown |
| Runtime | The Python runtime (Pyodide) | not loaded / loading / ready / failed |
| Formula styles | The KaTeX stylesheet | unconfigured / loading / loaded / failed |
| Browser capabilities | WebAssembly / WebGL / screen recording | ready / N missing |

**Only an unsatisfied chip can be opened**; satisfied ones are plain labels. Opening one shows the same panel, stating the same thing: every pending condition on this machine listed one by one (the browser-side sentences come from the core package; the local side states which items are missing), followed by what can be done right away.

- **Warm up now**: offered only while the runtime is "not loaded" or "failed". The first render waits for about 13 MB of runtime to arrive, and warming up removes that wait; pressing it produces a receipt (success says "runtime is ready", failure gives the reason), because warmup itself has no visual feedback.
- **Re-detect**: offered only when the local environment is missing items or cannot be reached; it asks the local environment again.
- The panel can be closed. "Not loaded" and "unconfigured" are not errors, only "not yet", so they do not appear among the error-coloured hints.

The two sides refresh differently because their data comes from different places:

- The **browser side refreshes automatically** as state changes — any change in the runtime phase, package fetch results or stylesheet load results is broadcast;
- The **local side** is queried once when entering the page and again on "re-detect". The Host caches the answer, so dozens of cards asking at once still run one probe.

All three places (status bar, Settings panel, chat card) read the same verdict, produced by the core package, so their wording never contradicts itself.

## Sample mode

The sample set has about ten entries covering basic shapes, transforms, axes and curves, `MathTex` formulas, text lists, bar charts, `TracedPath` trajectories, 3D scenes, and **one piece of bad code that should be rejected by the precheck**.

- Each entry has a status dot on its left: not run (hollow) / passed (green) / failed (red).
- After selecting an entry, the **expectation** ("what you should see", one sentence) appears above the preview — verify against it manually.
- Pass criteria: a normal sample passes when it renders successfully; the "should be rejected" entry is the **opposite** — it only passes when the render fails, verifying precisely that the precheck rejects it on the spot with a reason.

## Custom code mode

Write a free-form piece of Manim Python and run it, for constructs outside the samples. The code conventions match chat: both a complete `class` shell and bare `construct` body statements are accepted; render-time errors are shown as-is, without passing through the tool's precheck.

## Toolbar

| Control | Effect |
| --- | --- |
| Stop | Interrupts the current render |
| Clear records | Clears per-entry results and status dots |
| Turbo | Skips waiting for `run_time` and `wait`, landing directly on the final state. Toggling it re-runs the current entry under the new setting; updater-driven trajectories are still advanced, never left empty |
| Clear downloaded libraries | Deletes locally cached third-party packages, for re-verifying the "first fetch" flow. See [Settings Panel](/en/guide/settings#package-cache) |

## Progress persistence

Per-entry results, the turbo switch, custom code and the current mode are all stored in localStorage, so you can resume from the breakpoint after a refresh or interruption.
