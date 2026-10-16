# API Reference: Data Types

Every type on this page comes from the core package [manim-live](https://snowowowo.github.io/manim-live/) (`EnvironmentStatus`, `Surface`, `RunResult` and friends) — this plugin defines no outward types of its own. The page gives each type's full fields and value semantics; finer behavioural detail lives in the core package's docs.

| Type | Defined by | Purpose | Detail |
| --- | --- | --- | --- |
| `EnvironmentStatus` | Core package | Environment status snapshot | This page |
| `EnvironmentCapabilities` | Core package | Browser capabilities inside the snapshot | This page |
| `RuntimePhase` / `KatexPhase` | Core package | Two lifecycle phases | This page |
| `Surface` | Core package | One canvas | [Core package: Canvas](https://snowowowo.github.io/manim-live/en/api/surface) |
| `RunResult` | Core package | Outcome of one render | [Core package: Canvas](https://snowowowo.github.io/manim-live/en/api/surface) |

## Where types come from

The core package exports the types, so a normal value import is the right move — it is this plugin's **only** runtime dependency:

```ts
import { environmentStatus, type EnvironmentStatus, type Surface } from 'manim-live'
```

This plugin's own code reads it exactly that way (see `src/client/runtime-status.ts`): both the snapshot and the subscription of environment status come straight from that package.

## EnvironmentStatus

The environment status snapshot: the return of `environmentStatus()` and the value delivered to subscription callbacks. Four condition components plus a list of hints:

```ts
interface EnvironmentStatus {
  capabilities: EnvironmentCapabilities
  runtime: { phase: RuntimePhase; error?: string; indexURL: string | null }
  katex: { baseURL: string | null; phase: KatexPhase; error?: string }
  packages: { fetching: string[]; lastError?: string }
  hints: string[]
}
```

### capabilities

The result of a **one-off probe** of browser capabilities, cached for the lifetime of the page. It does not change with page state, only with the browser environment (a different machine or browser changes it).

```ts
interface EnvironmentCapabilities {
  wasm: boolean
  webgl: boolean
  videoExport: boolean
}
```

| Field | Consequence when missing |
| --- | --- |
| `wasm` | The Python interpreter cannot start; **no** rendering is available |
| `webgl` | manim-web cannot produce a picture; **no** rendering is available |
| `videoExport` | Affects only the "browser frame-by-frame export" path. Rendering and this plugin's mp4 export are unaffected |

### runtime

The lifecycle of the Pyodide runtime.

| Field | Meaning |
| --- | --- |
| `phase` | See the table below |
| `error` | Failure text when `phase` is `error` |
| `indexURL` | The currently registered fetch root. This plugin always uses bundled assets, so it points at the plugin's same-origin route; `null` if a loader was never installed |

| `phase` | Meaning | What you can do |
| --- | --- | --- |
| `idle` | Not loaded. The normal initial state before the first render | Wait |
| `loading` | Loading | Show a progress hint |
| `ready` | Ready, rendering is possible | Proceed normally |
| `error` | Load failed | Read `error`; `hints` already carries a matching suggestion |

**`idle` is not an error.** It means "not yet" rather than "something is wrong"; warning on it produces false positives.

### katex

The state of the stylesheet used by formulas typeset with `MathTex` / `Tex`.

| Field | Meaning |
| --- | --- |
| `baseURL` | The directory holding the stylesheet and fonts; `null` when unconfigured |
| `phase` | See the table below |
| `error` | Failure text when `phase` is `error` |

| `phase` | Meaning |
| --- | --- |
| `unconfigured` | No `katexBaseURL` was given when the renderer was created, so this plugin injects no stylesheet. Formulas still render, but as unstyled plain typesetting |
| `loading` | The stylesheet is being injected |
| `loaded` | Loaded |
| `error` | The stylesheet failed to load (`hints` will suggest checking whether `katex.min.css` and the font files are present in that directory) |

This plugin always configures `katexBaseURL`, so inside the host this field is only ever `loading`, `loaded` or `error`, never `unconfigured`.

### packages

Progress of on-demand fetches of third-party Python packages (packages not bundled but fetched once online, such as `import pandas`).

| Field | Meaning |
| --- | --- |
| `fetching` | Names currently being fetched; an empty array when nothing is in flight |
| `lastError` | A plain-language reason for the most recent fetch failure (including the tiered diagnosis conclusion). It stops appearing once a fetch succeeds |

### hints

**One actionable sentence per unmet condition**; an empty array when everything is satisfied. It covers only hard unmet conditions:

- Missing WASM / WebGL / MediaRecorder;
- Runtime startup failure;
- Formula stylesheet load failure;
- Package fetch failure.

"Formula stylesheet not configured" is not among them — that is a configuration choice rather than a fault, and it speaks only through the `warnings` of `check()`. The sentences in `hints` can be shown to users as-is; this plugin's Settings panel uses exactly these.

```ts
const status = environmentStatus()
if (status.hints.length > 0) showBanner(status.hints)
```

## Surface and RunResult

These two types belong to the core package; this plugin only passes them through, so their fields and behavioural contracts follow the core package docs:

- `Surface`: one canvas, with five members `run` / `replay` / `canvas` / `isRendered` / `dispose`, all obtained from the instance returned by `createSurface()`. See [Core package: Canvas](https://snowowowo.github.io/manim-live/en/api/surface).
- `RunResult`: the outcome of one render, `{ ok, error?, cancelled? }`. Note that `cancelled` being `true` means the canvas was destroyed and this piece of code never ran; it is **not an error** and nothing should be shown to the user.

```ts
const result = await surface.run(python)
if (result.cancelled === true) return
if (!result.ok) showError(result.error)
```
