# Laboratory

The "Manim 渲染" page in the left navigation is the laboratory: the corpus list on the left, the render preview on the right. Click any entry to run it, or "Render all" to execute in order; pass / fail status is marked on each entry immediately. The laboratory is not a separately implemented debug page — **the canvas uses the same component as the chat cards**, so manual playback, code viewing, export, and other capabilities behave exactly as in chat.

The top of the page offers two views: **Corpus laboratory** and **Custom code** (write and run a free-form piece of Python).

## Toolbar

- **Render all**: runs only the entries that have not yet passed; already-passed ones are skipped. The button next to a group title runs only that group.
- **Stop** / **Copy results** / **Clear records**.
- **Turbo**: skips waiting for `run_time` and `wait`, landing directly on the final state. Rendering all 236 entries at real speed takes minutes; turbo mode finishes instantly. Turn this switch off when you need to watch the animation unfold.

## Pass / fail criteria

Each corpus entry carries its own expectation (visible on hover). "Pass" is not "ran to completion without error" — **entries marked "should be rejected" only pass when the run fails** (what they verify is precisely "rejected on the spot with a reason given"). The red/green dots, the "N passed" counter, and resumption all follow this criterion.

"Copy results" includes each entry's outcome, error, and **source file path**; from that output you can locate the corresponding `.py` file directly.

## Progress persistence

Per-entry results, the turbo switch, custom code, and the current view are all stored in localStorage, so you can resume from the breakpoint after a refresh or interruption.

## Where the corpus lives

The corpus itself consists of complete Manim files under `_dev/examples/` in the core package `manim-live` repository (19 groups / 236 entries), runnable standalone:

```bash
manim ../manim-live/_dev/examples/basic/01-circle.py CircleScene
```

In a regular installation that directory does not exist, and the laboratory automatically falls back to the "Custom code" view — the corpus is a development-time regression suite and does not ship with the plugin.
