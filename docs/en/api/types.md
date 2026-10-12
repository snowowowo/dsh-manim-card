# API Reference: Data Types

The types involved in the service surface come in two halves: this plugin defines only `ManimService` and `CheckResult` itself, while the rest (`Surface`, `RunResult`, `EnvironmentStatus` and its substructures) are defined and exported by the core package [manim-live](https://snowowowo.github.io/manim-live/). This page gives every type's full fields and value semantics; finer behavioural detail lives on the corresponding method pages.

| Type | Defined by | Purpose | Detail |
| --- | --- | --- | --- |
| `ManimService` | This plugin | The service itself | [The manim-live Service](/en/api/service) |
| `CheckResult` | This plugin | Return of `check()` | [manim.check()](/en/api/service#manim-check-python) |
| `EnvironmentStatus` | Core package | Environment status snapshot | This page |
| `EnvironmentCapabilities` | Core package | Browser capabilities inside the snapshot | This page |
| `RuntimePhase` / `KatexPhase` | Core package | Two lifecycle phases | This page |
| `Surface` | Core package | One canvas | [Core package: Canvas](https://snowowowo.github.io/manim-live/en/api/surface) |
| `RunResult` | Core package | Outcome of one render | [Core package: Canvas](https://snowowowo.github.io/manim-live/en/api/surface) |

## Where types come from

For cross-plugin cooperation, take types with a **type-only import** and keep every runtime dependency on the service:

```ts
import type { CheckResult, EnvironmentStatus, Surface } from 'manim-live'
```

`import type` disappears entirely at compile time and does not pull in a second copy of the core package, so it is safe: it exists purely to type-check your own code. **Do not** write a value import in this position (`import { environmentStatus } from 'manim-live'`) — that brings in a second runtime whose reading is out of step with the one actually running, see [Overview](/en/api/#why-status-must-go-through-the-service).

To use these types, add `manim-live` to your own plugin's development dependencies (`devDependencies`); it is the same package this plugin depends on at runtime.

## CheckResult

The return of `check()`. Failure is expressed as data, not as an exception.

```ts
interface CheckResult {
  ok: boolean
  error?: string       // reason when ok is false, with line numbers
  warnings?: string[]  // non-blocking notices; absent when there are none
}
```

| Field | Present when | Meaning |
| --- | --- | --- |
| `ok` | Always | Whether the precheck passed |
| `error` | `ok` is `false` | Failure text that can be shown as-is or handed back to the model, with line numbers |
| `warnings` | There are notices | Non-blocking issues, one sentence each. They disappear once the code or the configuration changes |

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
  mediaRecorder: boolean
}
```

| Field | Consequence when missing |
| --- | --- |
| `wasm` | The Python interpreter cannot start; **no** rendering is available |
| `webgl` | manim-web cannot produce a picture; **no** rendering is available |
| `mediaRecorder` | Affects only "record directly in the browser", one export method. Rendering and this plugin's mp4 export are unaffected |

### runtime

The lifecycle of the Pyodide runtime.

| Field | Meaning |
| --- | --- |
| `phase` | See the table below |
| `error` | Failure text when `phase` is `error` |
| `indexURL` | The currently registered fetch root. This plugin always uses bundled assets, so it points at the plugin's same-origin route; `null` if a loader was never installed |

| `phase` | Meaning | What you can do |
| --- | --- | --- |
| `idle` | Not loaded. The normal initial state before the first render | Wait, or bring it up early with "Warm up now" in the Laboratory |
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

"Formula stylesheet not configured" is not among them — that is a configuration choice rather than a fault, and it speaks only through the `warnings` of `check()`. The sentences in `hints` can be shown to users as-is; this plugin's Laboratory status bar and Settings panel use exactly these.

```ts
const status = manim.environmentStatus()
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
