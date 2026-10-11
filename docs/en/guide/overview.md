# What It Is

This page gives the positioning of dsh-manim-live, how the three parties on the execution path divide the work, its relationship with the core package manim-live, and a feature list. If you just want to install and use it, go straight to [Installation](/en/guide/installation) and [Usage in Chat](/en/guide/usage).

## One-sentence positioning

dsh-manim-live is a plugin for DeepSeek Harness ("the host"): AI writes **standard Manim (Python) code** in the conversation, and a playable animation appears right in the chat stream.

## Why not native Manim directly

Native Manim rendering depends on a local environment (Python + manim + ffmpeg) and produces video files — it cannot live inside a chat stream, let alone keep up with an AI drawing while explaining. This plugin's pipeline: the AI writes **standard Manim code** and it is **rendered in real time in the browser** — the same code, with no local environment anywhere. A side-by-side comparison is in the core package's [What It Is](https://snowowowo.github.io/manim-live/guide/overview).

## Three parties, three jobs

From "AI writes code" to "an animation in the chat", three parties each own one stretch of the path:

- **The host provides the conversation and chat stream** — the AI produces code here and the animation cards appear here; the plugin integrates through the host's slot / service mechanism and is meaningless outside the host.
- **The core package manim-live provides canvas and execution** — the full ability to execute Python in the browser and render to a WebGL canvas in real time lives in that independent npm package.
- **This plugin provides host integration and the feature layer** — Host routes distribute the bundled resources (Pyodide / KaTeX) same-origin, registers the `manim_render` tool and the card UI, and builds pre-checks, playback scheduling, the laboratory, and mp4 export on top of the core package.

## Relationship with the core package manim-live

[manim-live](https://github.com/snowowowo/manim-live) ([docs](https://snowowowo.github.io/manim-live/)) is an independent npm package holding the core execution and rendering capabilities; this plugin is its integration layer inside the host. Choose by scenario:

- Want the AI to draw animations in host conversations, see cards, and export mp4 — use this plugin;
- Want the same canvas in your own page, outside the host — depend on the core package manim-live directly and read its docs.

## Feature list

| Feature | Entry | Notes |
| --- | --- | --- |
| Animation cards | Chat stream | Appear after the AI submits code via `manim_render`; support playback, code viewing, mp4 export — see [Usage in Chat](/en/guide/usage) |
| Dry-run pre-check | Inside the tool | The code is checked before the tool returns; syntax errors, undefined names, and unsupported constructs return `error` immediately |
| Playback scheduling | Inside the plugin | New cards play once in full, remounts fall to the last frame, active canvases beyond 8 are reclaimed by distance, and one Python queue serves the whole page |
| Laboratory | "Manim 渲染" in the left navigation | 19 groups / 236 corpus entries run one by one, plus free-form coding — see [Laboratory](/en/guide/lab) |
| Settings panel | "Manim 渲染" in host settings | Local environment probing and Python package cache management — see [Settings Panel](/en/guide/settings) |
| manim service | `ctx.get('manim')` | For other plugins: check(python) dry-run pre-check + createSurface(container) canvas — see [Third-party Plugin Integration](/en/guide/integrating) |
