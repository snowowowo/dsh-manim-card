# Laboratory

The laboratory lives in the "Manim 渲染" page of the left navigation. It is the **acceptance bench for this plugin's features**: card rendering, playback control, code viewing, mp4 export, and pre-check errors are all verified here. This page covers its interface, sample mode, custom code, and progress persistence.

The samples are a **built-in** small set (bundled into the plugin, available in regular installations too); the 239-entry corpus regression suite belongs to the core package [manim-live](https://github.com/snowowowo/manim-live) repository (`corpus/`) — this plugin does not maintain a corpus.

## Interface

The sample list sits on the left, the render preview on the right: click any entry to render it; pass / fail status is marked on each entry immediately. The laboratory is not a separately implemented debug page — **the canvas uses the same component as the chat cards**, so manual playback, code viewing, export, and other capabilities behave exactly as in chat.

The top of the page offers two modes: **Samples** and **Custom code** (write and run a free-form piece of Python).

## Environment status bar

A permanent environment readout sits below the page header with four chips: **local Manim** (which mp4 export goes through), **runtime**, **formula styles**, and **browser capabilities**. These four conditions decide whether a picture can be produced and whether an mp4 can be exported.

- Satisfied conditions are neutral labels; unsatisfied ones are coloured (amber = attention needed, red = failure) and can be opened.
- Opening one shows the same panel either way: every pending condition on this machine listed one by one (the browser-side sentences come from the core package; the local side states which items are missing), followed by what can be done right away — **warm up now** (start the runtime early; the first render waits for ~13 MB to download, and warming up removes that wait) and **re-detect** (ask the local environment again).
- A runtime that is "not loaded" and formula styles that are "unconfigured" are not errors, just "not yet": the former is a click away from warming up, the latter needs `katexBaseURL` passed when creating the renderer.
- The readout refreshes itself as state changes: on the browser side (runtime phase, package fetch results, formula-style load results) it updates the moment anything changes; the local side is queried once when entering the page and again on "re-detect" (the Host caches the answer, so dozens of cards asking at once still run one probe).

## Sample mode

The sample set has about ten entries covering basic shapes, transforms, axes and curves, MathTex formulas, text lists, bar charts, TracedPath trajectories, 3D scenes, and **one piece of bad code that should be rejected by the pre-check**.

- Each entry has a status dot on its left: not run (hollow) / passed (green) / failed (red).
- After selecting an entry, the **expectation** ("what you should see", one sentence) appears above the preview — verify against it manually.
- Pass criteria: a normal sample passes when it renders successfully; the "should be rejected" entry is the **opposite** — it only passes when the render fails, verifying precisely that the pre-check rejects it on the spot with a reason.

## Toolbar

- **Stop** / **Clear records**.
- **Turbo**: skips waiting for `run_time` and `wait`, landing directly on the final state. Toggling it re-runs the current entry under the new setting; updater-driven trajectories are still advanced, never left empty.
- **Clear downloaded libraries**: deletes locally cached third-party packages, for re-verifying the "first fetch" flow.

## Progress persistence

Per-entry results, the turbo switch, custom code, and the current mode are all stored in localStorage, so you can resume from the breakpoint after a refresh or interruption.
