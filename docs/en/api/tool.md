# API Reference: Host Tool

This plugin registers one host tool, `manim_render`, called by the model to turn a piece of Manim Python into an animation card in the chat stream. It is not a JavaScript API (this plugin exports no importable module), but it is the first outward surface of the plugin, and both its arguments and its return are stable contracts, so it belongs in the API reference. For the service surface see [The manim Service](/en/api/service).

## manim_render

```yaml
name: manim_render
parameters:
  python: string        # required
returns:
  ok: boolean
  error?: string
```

**Arguments**

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `python` | `string` | Yes | Manim Python source. Both forms are accepted: a complete file (`from manim import *` plus `class X(Scene)`) and bare statements from the body of `construct` |

**Returns**

| Field | Present when | Meaning |
| --- | --- | --- |
| `ok` | Always | Whether the precheck passed. `true` means the code has been written to the session and the card is about to appear in the chat stream |
| `error` | `ok` is `false` | Precheck failure text with line numbers, ready to be handed back to the model for self-correction |

An empty `python` (length 0 after trimming) returns `{ ok: false, error: 'python 不能为空' }` directly without starting the runtime.

## What the tool does and does not do

Before returning, the tool **dry-runs the code in a real interpreter**: it parses the syntax, then executes it on a "draw nothing" bridge, catching syntax errors, undefined names, and capabilities manim-web is measured not to support. Only calls that pass the precheck are written to the session log, and the card is folded out of that on the client side.

This precheck runs on the **host's Node side**, in a Python runtime unrelated to the local machine (the core package's `manim-live/node` `runPython` and `createDryRunBridge`). Consequently:

- The precheck does not require the user to have Python installed, and is unaffected by whether a local `manim` command exists — that is only needed for export;
- The precheck and browser rendering are **two runtimes**: it proves the code holds up at the Python level, which is not the same as the browser drawing a picture.

The tool itself **produces no picture**. Rendering happens in the browser and is carried by the chat card; render-time errors (real drawing, layout, WebGL) are reported by the card and never come back in the tool's return value. So `ok: true` means "the code was accepted", not "it has been drawn".

Also, `ok` and `error` are the entire tool return: the `warnings` from `check()` do not travel through the tool — they only serve UI hints, see [Data Types](/en/api/types#checkresult).

## Two companion registrations

For the tool to be usable, two pieces of context are needed besides the tool itself; this plugin registers both at load time.

**The domain skill `manim-live`.** A Markdown file (`skills/manim-live/SKILL.md`) covering the writing boundaries of manim_render, the available Manim APIs, and the manim-web capabilities measured to be missing along with alternatives. It is registered into the host's `skills` service as an in-memory string, so the model receives all of it in a single call without reading a file; when the `skills` service is absent this plugin logs one `console.error` and skips it, leaving the tool usable but the model dependent on the tool description alone.

**A resident short guide.** A short text installed into the system prompt (`manim-live:guide`) with five points on "when to call" and "how to write code": load the skill before writing code, prefer a complete file, on `ok: false` fix by line number and call once more, do not restate the picture in words, and remind the user after a successful render that the card will be folded away.

## What the user sees

A successful `manim_render` leaves one card in the chat stream. Its behaviour (automatic playback rules, manual playback, viewing code, exporting mp4) is in [Usage in Chat](/en/guide/usage). When the model calls it several times in parallel within one turn, several cards are produced, and only the last one plays in full — see [Usage in Chat](/en/guide/usage#auto-playback-rules).
