# API Reference: Overview and Entry Points

This page covers what dsh-manim-card exposes. Data structures are in [Data Types](/en/api/types), and the model-facing call contract is in [Host Tool](/en/api/tool).

For a first read, start with [What It Is](/en/guide/overview) and [Installation](/en/guide/installation).

## Two outward surfaces

The plugin has three kinds of consumers; interfaces are split by consumer and do not overlap:

| Consumer | Interface | Form | Docs |
| --- | --- | --- | --- |
| Model inside the host | `manim_card` tool | Host tool taking a piece of Python source | [Host Tool](/en/api/tool) |
| Users of the chat UI | Cards, Settings | UI, no programming | [Usage in Chat](/en/guide/usage), [Settings Panel](/en/guide/settings) |
| Developers of this plugin and the core package | `pnpm` scripts, the `src/` layering | Source | [Development & Debugging](/en/dev/) |

## No Cordis service is provided

**There is no `ctx.get('manim-card')` surface** (since 2026-10-16): this plugin `provide`s no service at all — no other plugin needs to consume it.

It also exports no JavaScript module that can be `import`ed: imports between plugins are forbidden by the host's convention. To use the same canvas in your own project, **depend on the core package [manim-live](https://snowowowo.github.io/manim-live/) directly** — the runtime, the canvas engine and the support surface all live there, and it knows neither the host nor which plugin is using it.

## Runtime and canvas (provided by the core package)

This plugin's card canvases come from the core package. A few behaviours worth knowing:

- A canvas has a fixed 1280×720 resolution that does not follow its container; to change the displayed size, scale the container with CSS. The background is fully transparent, so the host page's colour shows through.
- One Python execution queue serves the whole page (the interpreter and the WASM module are page-level singletons): cards render serially in submission order, and one long-running piece of code blocks the rest.
- Environment status (browser capabilities, runtime, formula stylesheet, package fetching) is maintained by the core package; this plugin's Settings panel reads it directly — see [Data Types](/en/api/types) for the fields.

## Where to start

- Arguments and return of the model-facing `manim_card` → [Host Tool](/en/api/tool)
- Fields of `EnvironmentStatus` and friends → [Data Types](/en/api/types)
- To use a canvas in your own project (outside the host) → the core package's [manim-live docs](https://snowowowo.github.io/manim-live/)
