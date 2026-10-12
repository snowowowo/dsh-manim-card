# API Reference: The manim-live Service

The `manim-live` service is provided by this plugin's client half and consumed by other plugins through `ctx.get('manim-live')`. It has one object, `ManimService`, with four methods: precheck, create canvas, read environment status, subscribe to status changes. This page covers each of them. How to obtain the service, its lifecycle and the cooperation boundary are in [Overview](/en/api/); type fields are in [Data Types](/en/api/types).

The service key carries `-live` instead of a bare `manim`: a service key is a **namespace shared across plugins**, and taking the generic word would reserve `manim` itself, forcing later plugins that expose Manim-related capabilities to work around it or collide. It follows the same scheme as the entry id, route prefix, skill name and slot ids; consumers must use the full name — `ctx.get('manim')` does not reach this service.

```ts
interface ManimService {
  check(python: string): Promise<CheckResult>
  createSurface(container: HTMLDivElement): Promise<Surface>
  environmentStatus(): EnvironmentStatus
  onEnvironmentStatus(cb: (status: EnvironmentStatus) => void): () => void
}
```

All four methods either return synchronously or return a Promise, and none throws: a failed `check()` is expressed as `ok: false`, and a failed `createSurface()` is expressed as a rejected Promise (creating a canvas involves WebGL, whose failure cannot be expressed as a return value).

## manim.check(python)

Dry-run precheck: the code is actually executed once in a real interpreter, it just produces no picture. It catches three classes of problems: syntax errors, undefined names, and capabilities that manim-web is measured not to support.

```ts
check(python: string): Promise<CheckResult>

interface CheckResult {
  ok: boolean
  error?: string       // reason when ok is false, with line numbers
  warnings?: string[]  // non-blocking notices; absent when there are none
}
```

**Parameter** `python`: the Manim Python source to check. Both forms are accepted — a complete file (`from manim import *` plus `class X(Scene)`) and bare statements from the body of `construct`.

**Returns** `Promise<CheckResult>`. `ok` being `true` means the precheck passed; when it is `false`, `error` is text that can be shown as-is or handed back to the model.

**Example**

```ts
const manim = ctx.get('manim-live')
if (!manim) return

const result = await manim.check(python)
if (!result.ok) {
  render(result.error)   // show it directly: the message already carries line numbers and a reason
  return
}
if (result.warnings?.length) showHint(result.warnings)
// …create a canvas and render
```

**Notes**

- **Failure returns `ok: false` and never throws.** Throwing would take the caller down with it — which is worse than the service being absent, so this rule must not be broken.
- The precheck runs in a real interpreter, so the first call also brings up the Pyodide runtime (if not yet loaded) and may wait for one runtime download. To move that wait ahead of rendering, read `runtime.phase` from `environmentStatus()`, or let the user press "Warm up now" on the Laboratory status bar.
- Empty source (length 0 after trimming) returns `{ ok: true }` directly without starting the runtime.
- **A passing precheck does not guarantee a successful render**: it runs the "draw nothing" bridge, so errors involving real drawing and layout only surface at `Surface.run()`. Render-time errors are the caller's to handle.
- `warnings` reports only non-blocking issues (typically "the code contains formulas while the renderer was created without a formula stylesheet configured"); it does not affect the `ok` verdict.
- Only one piece of code runs at a time on a page: precheck and rendering share one serial queue, see [Overview](/en/api/#one-runtime-one-queue).

## manim.createSurface(container)

Creates a manim canvas inside the given container and returns it.

```ts
createSurface(container: HTMLDivElement): Promise<Surface>
```

**Parameter** `container`: the canvas container element. It is provided by the caller and its lifecycle is managed by the caller too — this plugin only mounts a canvas into it, and never creates, moves or destroys the container.

**Returns** `Promise<Surface>`. The Promise is there because creating a canvas first loads manim-web and creates a WebGL scene, which takes real time. The five members of `Surface` (`run` / `replay` / `canvas` / `isRendered` / `dispose`) belong to the core package; their definitions and behavioural contracts are in [Canvas](https://snowowowo.github.io/manim-live/en/api/surface).

**Example**

```ts
const stage = document.querySelector('#stage') as HTMLDivElement
const surface = await manim.createSurface(stage)

const result = await surface.run(python)
if (!result.ok) console.error(result.error)

// always release when done: the canvas holds a WebGL context
surface.dispose()
```

**Notes**

- **You must call `dispose()` yourself.** A canvas holds a WebGL context, and a browser has a limited number of them; failing to release means the page can no longer create new canvases. This plugin also `dispose()`s every canvas it created when it unloads, but that should not be treated as a fallback.
- The container's contents are cleared when the scene changes (`replay()`, or when the code contains a 3D scene). Do not put other elements you need to keep inside the container.
- A canvas has a fixed 1280×720 resolution that does not follow its container; scale the container with CSS to change the displayed size — the coordinate system is unaffected.
- Canvases on a page share one interpreter and one execution queue: a caller's canvas and a chat card's canvas never play at the same time.
- The service surface accepts exactly one argument, the container. `SurfaceOptions` (the `fast` mode and a default `onLoading` for all `run`s on that canvas) and export adapters are internal capabilities of this plugin and are not exposed here; if you genuinely need them, extend `src/client/service.ts` as described in [Development & Debugging](/en/dev/) and **do not** bypass the service by depending on the core package directly — the reason is in [Why status must go through the service](/en/api/#why-status-must-go-through-the-service).

## manim.environmentStatus()

An environment status snapshot: four groups of runtime conditions that "decide whether a picture can appear", plus a list of actionable hints. It issues no load or probe requests; it only reads state that has already happened.

```ts
environmentStatus(): EnvironmentStatus
```

**Returns** `EnvironmentStatus`, with four components:

| Field | Meaning |
| --- | --- |
| `capabilities` | Browser capabilities: `wasm` (the basis of the Python interpreter), `webgl` (the exit for any picture), `mediaRecorder` (affects only in-browser recording export) |
| `runtime` | The Pyodide runtime: `phase` (`idle` / `loading` / `ready` / `error`), `error`, `indexURL` (the current fetch root) |
| `katex` | Formula stylesheet: `baseURL`, `phase` (`unconfigured` / `loading` / `loaded` / `error`), `error` |
| `packages` | On-demand package fetches: `fetching` (names being fetched), `lastError` (a plain-language reason for the most recent failure) |
| `hints` | One actionable sentence per unmet condition; an empty array when everything is satisfied |

Values and semantics of each field are in [Data Types](/en/api/types#environmentstatus).

**Example**

```ts
const status = manim.environmentStatus()

// Common usage 1: no picture until ready — say why instead
if (status.runtime.phase !== 'ready') {
  renderPlaceholder(status.hints.length ? status.hints : ['runtime not loaded yet'])
  return
}

// Common usage 2: warn only when there is a hard unmet condition
if (status.hints.length > 0) showBanner(status.hints)
```

**Notes**

- **What you read must be this plugin's own reading**: that is exactly why it goes through the service rather than being imported from the core package by the caller, see [Overview](/en/api/#why-status-must-go-through-the-service).
- A snapshot is not an action: it only answers "what state is it in now". `idle` and `unconfigured` are not errors, they are "not yet".
- The capability probe is computed once and cached; its cost is negligible.
- `hints` contains only hard unmet conditions (missing capability, runtime or stylesheet load failure, package fetch failure). "Formula stylesheet not configured" is a configuration choice and only appears in the `warnings` of `check()`.

## manim.onEnvironmentStatus(cb)

Subscribes to environment status changes: any change in the runtime phase, the stylesheet load result, or package fetch progress broadcasts the latest snapshot once. Returns an unsubscribe function.

```ts
onEnvironmentStatus(cb: (status: EnvironmentStatus) => void): () => void
```

**Parameter** `cb`: receives the latest snapshot. If the callback itself throws, this plugin logs one line with `console.error` and the remaining subscribers are unaffected.

**Returns** `() => void`: unsubscribe. **Callers must call it on unmount** — the subscriber set lives inside this plugin's bundle, so not unsubscribing means an unmounted component keeps being called back.

**Example**

```ts
// Typical usage: status chips refresh themselves when the runtime becomes ready
const unsubscribe = manim.onEnvironmentStatus((status) => {
  setRuntimePhase(status.runtime.phase)
  setFetching(status.packages.fetching)
})

return unsubscribe   // hand it to your own cleanup point
```

**Notes**

- Broadcasts are **synchronous**: the callback runs inside the same synchronous flow as the state transition, so do not do heavy work in it or trigger another render from it.
- The subscription broadcasts **changes only** and does not replay the current value. Read an initial value with `environmentStatus()` right after obtaining the service, then subscribe; otherwise state between the two calls is missed.
- It coexists with `Surface.run()`'s per-call callbacks without conflict: those hang off a single call, this one hangs off page-level state.
