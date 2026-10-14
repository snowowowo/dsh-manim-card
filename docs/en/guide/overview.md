# What It Is

This page positions dsh-manim-card: what it adds to the host, how it differs from native Manim, which stretch of the path each of the three parties owns, and where the boundary with the core package `manim-live` runs. To install and use it, go straight to [Installation](/en/guide/installation) and [Usage in Chat](/en/guide/usage).

## One-sentence positioning

dsh-manim-card is a plugin for DeepSeek Harness ("the host"): AI writes **standard Manim (Python) code** in a conversation, and a playable, code-inspectable, mp4-exportable animation card appears right in the chat stream.

## What it adds to the host

| Where it lands | What | Detail |
| --- | --- | --- |
| Chat stream | Animation cards: they appear after the AI calls `manim_render` and support playback, code viewing and mp4 export | [Usage in Chat](/en/guide/usage) |
| A tool | `manim_render`: the code is dry-run in a real interpreter on the Node side before the tool returns, so syntax errors, undefined names and unsupported constructs come back as `error` immediately | [Host Tool](/en/api/tool) |
| Dev bench panel | The manim-card panel aggregated by the dev bench (dsh-devbench, dev-only): an acceptance bench with a built-in sample set plus free-form code | [Laboratory](/en/guide/lab) |
| Settings panel | A "Manim 渲染" section: the browser runtime, local environment probing and package cache management | [Settings Panel](/en/guide/settings) |
| Cross-plugin service | The Cordis service `manim-card`: precheck, canvases, environment status snapshot and subscription | [Third-party Plugin Integration](/en/guide/integrating) |

Playback scheduling inside the plugin deserves a sentence of its own: a new card plays once in full when it first enters the viewport, remounts land on the last frame, active canvases beyond 8 are reclaimed by distance from the reading position, and one Python execution queue serves the whole page. The rules are listed one by one under [Usage in Chat](/en/guide/usage#auto-playback-rules).

## Compared with native Manim

The code is the same standard Manim Python; only "where it runs and how a picture comes out" differs:

| | Native Manim (CLI) | This plugin |
| --- | --- | --- |
| Code written | Standard Manim Python | The same code, runnable as-is |
| Execution environment | Python + manim + ffmpeg installed locally (plus LaTeX for formulas) | Pyodide inside the browser, zero local install |
| How a picture comes out | Rendered offline to mp4; playback and embedding are a separate problem | Rendered live inside the chat stream — write it and it plays |
| Pacing with the explanation | One render must wait for the whole pipeline | Plays when it enters the viewport; the precheck stops broken code before rendering |
| mp4 export | Produced directly by the CLI | Reuses the local manim CLI for real rendering; the file lands in "Downloads" |
| Deployment cost | Install the environment on every machine, or run a render server | Install one plugin; runtime assets ship with it and no external CDN is involved |

The usable surface is the common subset of Manim CE; coverage and gaps follow the core package's [Support Surface](https://snowowowo.github.io/manim-live/en/guide/support).

## Three parties, three jobs

From "AI writes code" to "an animation in the chat", three parties each own one stretch:

| Party | Owns | Does not own |
| --- | --- | --- |
| The host | The conversation and chat stream, the slot and service systems, invocation and logging of `manim_render` | Rendering, Manim syntax, the local environment |
| Core package [manim-live](https://snowowowo.github.io/manim-live/) | Python execution in the browser, the manim adaptation layer, the WebGL canvas, environment status verdicts | Host integration, card UI, export, asset routes |
| This plugin | Host integration (routes, tool, slots), cards and playback scheduling, the Laboratory, the Settings panel, mp4 export, the cross-plugin service | Rendering and execution themselves |

The interfaces are split into three outward surfaces by consumer: the [`manim_render` tool](/en/api/tool) for the model, the [manim-card service](/en/api/service) for other plugins, and the chat cards plus Laboratory for people. This plugin **exports no JavaScript module that can be `import`ed** — imports between plugins are forbidden by the host's convention, so the service is the only path for cross-plugin work.

## Relationship with the core package manim-live

[manim-live](https://github.com/snowowowo/manim-live) ([docs](https://snowowowo.github.io/manim-live/)) is an independent npm package holding the core execution and rendering capabilities; this plugin is its integration layer inside the host. Choose by scenario:

| You want | Use |
| --- | --- |
| AI drawing animations in host conversations, cards, mp4 export | This plugin |
| The same canvas inside your own page or product, outside the host | The core package manim-live |
| The canvas and runtime already inside the host, from your own plugin | This plugin's [manim-card service](/en/guide/integrating) |
| Batch regression over a corpus (239 cases) | `corpus/` in the core package repository; this plugin maintains no corpus |

## Not a fit for

- **Server-side batch video rendering**: use the native manim CLI pipeline. This plugin's precheck depends on the host's Node-side runtime and its export depends on the local CLI; neither targets batch output.
- **Standalone products outside the host**: depend on the core package manim-live directly.
- **The full Manim surface**: follow the core package's support surface.

## Where to start

- Install it and get a first card → [Installation](/en/guide/installation), [Usage in Chat](/en/guide/usage)
- Verify the plugin's features work → [Laboratory](/en/guide/lab)
- Check this machine's conditions (can it render, can it export) → [Settings Panel](/en/guide/settings)
- Use a canvas in your own plugin → [Third-party Plugin Integration](/en/guide/integrating), interface detail in the [API Reference](/en/api/)
