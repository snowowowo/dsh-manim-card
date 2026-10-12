# Third-party Plugin Integration

This page is for developers who want to use the Manim runtime and canvas inside their own plugin: what you can get, how to get it, when to release it, and what the service deliberately does **not** provide. Each member is specified in the [API Reference](/en/api/) — this page walks the integration path once and does not repeat signatures.

## What the service gives you

This plugin provides the Cordis service `manim-live`, returning a `ManimService` with four capabilities:

| Capability | Method | Typical use |
| --- | --- | --- |
| Dry-run precheck | `check(python)` | Stop syntax errors, undefined names and unsupported constructs before rendering |
| Create a canvas | `createSurface(container)` | Render Manim Python inside a container you provide |
| Read environment status | `environmentStatus()` | Decide whether the runtime is ready and whether anything hard is blocking |
| Subscribe to status changes | `onEnvironmentStatus(cb)` | Status chips, refreshing the UI at the moment things become ready |

Imports between plugins are forbidden, so the service is the only collaboration surface. Other than it, this plugin exports no JavaScript module that can be `import`ed.

## How to get it

Fetch it inside your own client half's `apply(ctx)`, **soft-optionally**:

```js
export default {
  inject: ['slots'],
  apply(ctx) {
    const manim = ctx.get('manim-live')
    if (!manim) return   // not installed / disabled / not loaded yet: degrade to your own presentation
    // …use manim
  },
}
```

Two things are mandatory:

- Use `ctx.get()` and **not** `inject`. In this version of Cordis `inject` is a hard dependency, and a missing service prevents your whole plugin from loading; this service is by definition "use it if it is there, otherwise do without", so `get()` is the only option.
- The service appears after the plugin loads and disappears on unload, so never **cache the result of `ctx.get()` across a lifecycle**: check on each use, or clean up your own reference when the service goes away.

## Minimal working example

One piece of code → precheck → canvas → render → release, plus a status subscription:

```tsx
function Stage({ manim, python }: { manim: ManimService; python: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState('')

  // Read an initial value first, then subscribe: the subscription broadcasts changes only
  const [phase, setPhase] = useState(() => manim.environmentStatus().runtime.phase)
  useEffect(() => manim.onEnvironmentStatus((s) => setPhase(s.runtime.phase)), [manim])

  useEffect(() => {
    let surface: Surface | null = null
    let dropped = false

    void (async () => {
      const checked = await manim.check(python)
      if (dropped) return
      if (!checked.ok) { setNote(checked.error ?? 'precheck failed'); return }

      surface = await manim.createSurface(hostRef.current!)
      const result = await surface.run(python)
      if (dropped) return
      if (result.cancelled !== true && !result.ok) setNote(result.error ?? 'render failed')
    })()

    // Releasing is your job: the canvas holds a WebGL context
    return () => { dropped = true; surface?.dispose() }
  }, [manim, python])

  if (phase !== 'ready') return <p>runtime {phase === 'loading' ? 'loading' : 'not ready'}</p>
  return <div ref={hostRef}>{note && <p>{note}</p>}</div>
}
```

Three things here are contracts rather than style:

- `check()` expresses failure as `ok: false` and **never throws** — it will not take your call chain down, and you need not wrap it in try.
- `result.cancelled === true` means the canvas was destroyed and this piece of code never ran; it is **not an error** and nothing should be shown to the user.
- `surface.dispose()` must be called by you.

## Read status from the service, do not import the core package

To see environment status, use `manim.environmentStatus()`, **not** `import { environmentStatus } from 'manim-live'`.

The reason is correctness: plugins are bundled separately, so a direct import pulls in a second copy of the core package whose runtime phase, subscriber set and Pyodide singleton are different instances, making the reading permanently `idle` — the copy that is actually running lives in this plugin's bundle. The symptom is "no error, it simply always shows not loaded".

**Types are the exception**: `import type` disappears at compile time and does not create a second runtime. Add `manim-live` to your own plugin's `devDependencies` and take types only:

```ts
import type { CheckResult, EnvironmentStatus, ManimService, Surface } from 'manim-live'
```

## Lifecycle and release

| Moment | Your responsibility |
| --- | --- |
| The service is absent | Degrade to your own presentation without erroring or blocking |
| You have a canvas | The container is yours, the contents are written by this plugin; switching scenes clears the container's contents |
| You are done with a canvas | Call `surface.dispose()` yourself. Not releasing exhausts the browser's available WebGL contexts |
| You unmount a component | Unsubscribe from `onEnvironmentStatus`; release every canvas you created |
| This plugin unloads | The service disappears and **every canvas it created becomes invalid**; any `Surface` you still hold is no longer usable |

The runtime is a **page-level singleton**: canvases you create share one Python execution queue with the chat cards' canvases, so nothing ever contends for the interpreter — but conversely, a long run on one side blocks the other.

## What the service does not provide

| Not provided | Why | What to do |
| --- | --- | --- |
| Card UI, playback scheduling | This plugin's own entry points; their presentation is unrelated to your scenario | Build your own UI and render with `createSurface()` |
| The `manim_render` tool | It faces the model, not plugins | Decide yourself when to generate code |
| mp4 export | It depends on the host and the local environment; it is not a general capability | See the core package's [Export](https://snowowowo.github.io/manim-live/en/api/export), or use the host's own file capabilities |
| The `fast` mode and per-run fetch callbacks | The service surface currently takes only a container | Extend `src/client/service.ts` as described in [Development & Debugging](/en/dev/); do not bypass the service by depending on the core package |
| Warmup | It involves about 16 MB of traffic, and when to spend that should be the user's call | Point users at "Warm up now" in the [Laboratory](/en/guide/lab#environment-status-bar) |

If your goal is to use the same canvas **outside the host**, in your own page, you do not need this service — depend on the core package [manim-live](https://snowowowo.github.io/manim-live/) directly.

## Further reading

- [API Reference: Overview and Entry Points](/en/api/): object graph, obtaining the service, lifecycle
- [API Reference: The manim-live Service](/en/api/service): all four members, their arguments, returns and boundaries
- [API Reference: Data Types](/en/api/types): every field of `CheckResult` and `EnvironmentStatus`
