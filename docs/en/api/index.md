# API Reference: Overview and Entry Points

This page covers what dsh-manim-card exposes, how to obtain it, and how long it lives. The remaining pages each cover one surface: service members in [The manim-card Service](/en/api/service), data structures in [Data Types](/en/api/types), and the model-facing call contract in [Host Tool](/en/api/tool).

For a first read, start with [What It Is](/en/guide/overview) and [Installation](/en/guide/installation); to use a canvas in your own plugin, start with [Third-party Plugin Integration](/en/guide/integrating).

## Three outward surfaces

The plugin has four kinds of consumers; interfaces are split by consumer and do not overlap:

| Consumer | Interface | Form | Docs |
| --- | --- | --- | --- |
| Model inside the host | `manim_render` tool | Host tool taking a piece of Python source | [Host Tool](/en/api/tool) |
| Other plugins | `ctx.get('manim-card')` | Cordis service returning `ManimService` | This page and [The manim-card Service](/en/api/service) |
| Users of the chat UI | Cards, Laboratory, Settings | UI, no programming | [Usage in Chat](/en/guide/usage), [Laboratory](/en/guide/lab), [Settings Panel](/en/guide/settings) |
| Developers of this plugin and the core package | `pnpm` scripts, the `src/` layering | Source | [Development & Debugging](/en/dev/) |

**The plugin exports no JavaScript module that can be `import`ed.** Imports between plugins are forbidden by the host's convention, so cross-plugin cooperation has exactly one path: the service. To use the same canvas outside the host, depend on the core package [manim-live](https://snowowowo.github.io/manim-live/) directly.

## Object graph

Everything starts at `ctx.get('manim-card')`. The returned `ManimService` is everything a caller can obtain:

```
ctx.get('manim-card')                     → ManimService | undefined   undefined when the service is absent
├─ check(python)                     → Promise<CheckResult>
├─ createSurface(container)          → Promise<Surface>           one canvas per call
│  ├─ run(code, handlers?)           → Promise<RunResult>         ← the five members below belong to the core package
│  ├─ replay()                       → Promise<void>
│  ├─ canvas()                       → HTMLCanvasElement | null
│  ├─ isRendered()                   → boolean
│  └─ dispose()                      → void
├─ environmentStatus()               → EnvironmentStatus          snapshot
└─ onEnvironmentStatus(cb)           → () => void                 subscription, returns unsubscribe
```

Three notes on reading this graph:

- All four members of `ManimService` are methods; there are no properties. A `Surface` can only be produced by `createSurface()` and cannot be constructed separately; its members and behavioural contracts belong to the core package, see [Canvas](https://snowowowo.github.io/manim-live/en/api/surface).
- The service surface covers exactly three things: precheck, canvas, environment status. Card UI, the `manim_render` tool, playback scheduling, the Laboratory and export are this plugin's own entry points and are not part of the service — a caller that wants to display something must build its own UI.
- Status has two exits: the outcome of a single run is in the return value of `check()` / `run()`, and page-level environment conditions are in `environmentStatus()` and its subscription, see [The manim-card Service](/en/api/service).

## Obtaining the service

The service is `provide`d by this plugin's client half at load time. A caller fetches it on demand inside its own `apply(ctx)`:

```js
// your own plugin's client.js
export default {
  inject: ['slots'],
  apply(ctx) {
    const manim = ctx.get('manim-card')
    if (!manim) return   // soft-optional: degrade gracefully when this plugin is absent
    // …use manim
  },
}
```

**Soft-optional consumption** is a hard contract of this service: when this plugin is not installed, is disabled, or has not loaded yet, `ctx.get('manim-card')` returns `undefined`. Use `ctx.get()` and **not** `inject` — in this version of Cordis `inject` is a hard dependency, and a missing service prevents the whole plugin from loading; this service is by definition "use it if it is there, otherwise do without", so `get()` is required.

Callers must therefore guarantee that when the service is absent they fall back to their own presentation without erroring or blocking. Conversely, this plugin does not guarantee the service exists at all times — it appears after the plugin loads and disappears on unload, see below.

## Lifecycle

| Moment | What happens |
| --- | --- |
| This plugin loads | The renderer is wired to the host routes, then `provide('manim-card')` runs; from then on `ctx.get('manim-card')` works |
| Caller creates a canvas | `createSurface()` mounts a WebGL canvas into the container you provide; the container is not managed by this plugin |
| Caller is done | You must call `surface.dispose()` yourself: a canvas holds a WebGL context, and not releasing it is a leak |
| This plugin unloads | The service is released first, then the renderer is `dispose()`d — **every canvas it created becomes invalid**, and the injected KaTeX stylesheet is removed |

That last row is the one to watch: **after this plugin unloads, any `Surface` a caller still holds is no longer usable.** A caller that keeps canvases around for a long time should watch for the service disappearing and clean up its own container; conversely, after the plugin reloads, the new service is a new object and old references do not come back to life.

```ts
// Only use the service while it exists: check on each use, never cache across a lifecycle
const surface = await manim.createSurface(container)
// …use it…
surface.dispose()   // do not leave this to the plugin's dispose as a fallback
```

## Why status must go through the service

Environment status is not something that can be recomputed from scratch — it is **the reading of this plugin's own runtime and stylesheet injection**. A caller that bypasses the service and reads status by importing `'manim-live'` directly gets a wrong answer:

- Plugins are bundled separately, so a direct import pulls in a **second copy** of the core package;
- Inside that second copy, the runtime phase, the subscriber set and the Pyodide singleton are **different instances**, so the reading is permanently `idle`;
- The copy that is actually running lives inside this plugin's bundle, and only the service surface can reach it.

The symptom is "no error, it simply always shows not loaded" — so this is a correctness issue, not a matter of style.

**Types are the exception**: `import type` disappears entirely at compile time and does not create a second runtime. To use the type definitions, add `manim-live` as a development dependency and take types only:

```ts
import type { EnvironmentStatus, CheckResult } from 'manim-live'
```

## One runtime, one queue

This plugin and its callers share a single page-level runtime: the Python interpreter, the WASM module and the serial execution queue are all page-level singletons. Consequently:

- Chat cards and canvases created by callers never contend for the interpreter; renders execute serially in submission order;
- A long-running piece of code on one side blocks the other — which is the same statement as "one queue per page";
- Warming up (the action on the Laboratory status bar) also joins that queue, so renders submitted during warmup are queued behind it.

A canvas has a fixed 1280×720 resolution that does not follow its container; to change the displayed size, scale the container with CSS. The background is fully transparent, so the host page's colour shows through.

## Where to start

- To use a canvas in your own plugin → [Third-party Plugin Integration](/en/guide/integrating)
- Every member of the service, explained one by one → [The manim-card Service](/en/api/service)
- Fields of `CheckResult` / `EnvironmentStatus` and friends → [Data Types](/en/api/types)
- Arguments and return of the model-facing `manim_render` → [Host Tool](/en/api/tool)
