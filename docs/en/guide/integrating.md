# Third-party Plugin Integration

This page is for developers who want to use the Manim runtime and canvas inside their own plugins. This plugin provides the service `manim`: **runtime + canvas**. Other plugins obtain it via `ctx.get('manim')` — imports between plugins are forbidden; services are the only collaboration surface.

**Soft optional consumption**: when the service is absent (this plugin not installed or disabled), the caller degrades to "no canvas", **without erroring or blocking**:

```js
// In client.js's apply(ctx):
const manim = ctx.get('manim')
if (manim) {
  // Use the service; degrade to your own presentation when absent
}
```

## Service interface

```ts
interface ManimService {
  /** Dry-run pre-check: returns ok:false on syntax errors / undefined names / unsupported
      constructs — the caller needs no validation of its own. */
  check(python: string): Promise<{ ok: boolean; error?: string }>
  /** Creates a manim canvas inside the given container; the container is provided by the
      caller, and its lifecycle is managed by the caller too. */
  createSurface(container: HTMLDivElement): Promise<Surface>
}
```

- **`check()` returns `ok:false` on failure instead of throwing** — a throw would crash the caller along with it.
- **The `Surface` returned by `createSurface()` must have `dispose()` called when done**: the canvas holds a WebGL context that needs a real release (see the core package's [manim-live contracts doc](https://snowowowo.github.io/manim-live/guide/contracts) for details).
- The runtime is a **page-level singleton**: canvases created by callers share the same Python execution queue as the chat cards' canvases, so multiple cards never fight over the interpreter.

## What the service does not include

Card UI, the Host tool (`manim_render`), and playback scheduling are this plugin's own entry points and are not part of the service — callers build their own UI and render with `createSurface()` themselves. To use the canvas outside the host, depend on the core package [manim-live](https://snowowowo.github.io/manim-live/) directly.
