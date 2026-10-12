---
layout: home

hero:
  name: dsh-manim-live
  text: Manim animations in chat
  tagline: "A DeepSeek Harness plugin: the AI writes standard Manim (Python) code in the session and a playable animation card appears right in the chat stream — replayable, inspectable, exportable as mp4. The code runs in the browser; no local Python required."
  actions:
    - theme: brand
      text: Installation
      link: /en/guide/installation
    - theme: alt
      text: Usage in Chat
      link: /en/guide/usage
    - theme: alt
      text: GitHub
      link: https://github.com/snowowowo/dsh-manim-live

features:
  - icon: 💬
    title: Animation cards
    details: The AI submits code through the manim_render tool and an animation card with a WebGL canvas appears in the chat stream; manual replay, source viewing, and mp4 export are supported.
  - icon: 🩺
    title: Pre-check before presenting
    details: Before the tool returns, the code is dry-run; syntax errors and unsupported constructs fail on the spot, so blank or broken cards never appear in the chat.
  - icon: 🎛️
    title: Playback scheduling
    details: A new card plays through once when it enters the viewport, and remounts land directly on the final frame; when several cards are produced in parallel within one step, only the last one plays; the whole page shares one Python execution queue.
  - icon: 🧪
    title: Laboratory
    details: "An acceptance bench with a built-in sample set plus free-form code: verify card rendering, playback control, export, and pre-check errors one by one."
  - icon: ⚙️
    title: Settings panel
    details: The browser runtime (Python runtime / formula styles / WebGL / WASM) and the local python3 / manim / ffmpeg environment sit in two cards; the local cache of third-party libraries supports pre-caching and deletion.
  - icon: 🚦
    title: Environment status
    details: The four condition groups deciding "can it render, can it export" are collected into one readable status, shared by the Laboratory status bar, the Settings panel and chat cards, with an actionable remedy for each unmet item.
  - icon: 🔌
    title: The manim-live service
    details: Other plugins obtain the runtime and a canvas via ctx.get('manim-live') — dry-run precheck, canvas creation, environment status, and status subscription; when the service is absent callers neither error nor block.
---

## Quick Start

1. Install the plugin into DeepSeek Harness desktop following [Installation](/en/guide/installation);
2. Say "用 Manim 画一个单位圆" (draw a unit circle with Manim) in a session — once the AI submits the Python code, an animation card appears in the chat stream and rests on the final frame after playback.

## All Sections

| Group | Section | Content |
| --- | --- | --- |
| Getting Started | [What It Is](/en/guide/overview) | Positioning, the difference from native Manim, the three parties, the boundary with the core package manim-live, capability list |
| Getting Started | [Installation](/en/guide/installation) | Prerequisites, install paths, bundled assets, what the first run waits for, what is fetched on demand |
| Getting Started | [Usage in Chat](/en/guide/usage) | How cards come into being, auto-playback rules, manual playback, code viewing, mp4 export, and what a card says when the environment falls short |
| Features | [Laboratory](/en/guide/lab) | An acceptance bench with a built-in sample set plus free-form code, including a permanent four-condition status bar |
| Features | [Settings Panel](/en/guide/settings) | The browser runtime, local environment probing, and Python package cache management |
| Integration | [Third-party Plugin Integration](/en/guide/integrating) | What the service gives you, how to get it, a minimal example, lifecycle and release, what it does not provide |
| API Reference | [Overview and Entry Points](/en/api/) | The three outward surfaces, the object graph, obtaining the service, and why status must go through it |
| API Reference | [The manim-live Service](/en/api/service) | All four members one by one: `check` / `createSurface` / `environmentStatus` / `onEnvironmentStatus` |
| API Reference | [Data Types](/en/api/types) | Every field and value semantic of `CheckResult`, `EnvironmentStatus` and its substructures |
| API Reference | [Host Tool](/en/api/tool) | Arguments and return of `manim_render`, its precheck boundary, and the companion skill and resident guide |
| Development | [Development & Debugging](/en/dev/) | Source layering, build, tests, development installation, the core package dependency, troubleshooting entry points |
