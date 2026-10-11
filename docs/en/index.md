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
    details: Probes the local python3 / manim / ffmpeg environment (export depends on it) and manages the local cache of third-party libraries, with pre-caching and deletion.
---

## Quick Start

1. Install the plugin into DeepSeek Harness desktop following [Installation](/en/guide/installation);
2. Say "用 Manim 画一个单位圆" (draw a unit circle with Manim) in a session — once the AI submits the Python code, an animation card appears in the chat stream and rests on the final frame after playback.

## All Sections

| Group | Section | Content |
| --- | --- | --- |
| Getting Started | [What It Is](/en/guide/overview) | Positioning in one sentence, the three parties, the relationship with the core package manim-live, feature list |
| Getting Started | [Installation](/en/guide/installation) | Install commands, bundled assets (Pyodide / KaTeX), which features need the network or local tools |
| Getting Started | [Usage in Chat](/en/guide/usage) | How cards come into being, auto-playback rules, manual playback, code viewing, mp4 export |
| Features | [Laboratory](/en/guide/lab) | An acceptance bench with a built-in sample set plus free-form code |
| Features | [Settings Panel](/en/guide/settings) | Local environment probing and Python package cache management |
| Integration | [Third-party Plugin Integration](/en/guide/integrating) | The manim service: check(python) dry-run pre-check + createSurface(container) canvas creation |
| Development | [Development & Debugging](/en/dev/) | For this plugin's developers: build, tests, development installation, troubleshooting entry points |
