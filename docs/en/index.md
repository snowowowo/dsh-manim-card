---
layout: home

hero:
  name: dsh-manim-live
  text: Render Manim animations in chat
  tagline: "A DeepSeek Harness plugin: AI writes Manim (Python) code in the conversation, and a playable animation card appears instantly in the chat stream — real Python execution, WebGL rendering, mp4 export. Works out of the box; no other plugin required."
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
    title: Animation cards in the chat stream
    details: "AI calls the manim_render tool and an animation card appears in the chat stream: real Python runs on Pyodide, plays on a WebGL canvas, with manual playback, code viewing, and export."
  - icon: 🩺
    title: Dry-run pre-check before presenting
    details: Before the tool returns, the code is dry-run against an empty bridge; syntax errors, undefined names, and unsupported constructs come back as an error on the spot — a card presented to the user never shows a blank screen.
  - icon: 🎛️
    title: Controlled playback scheduling
    details: Only newly generated cards play through once; any remount lands directly on the final frame. When several cards are produced in parallel within one step, only the last one plays. The whole page shares a single Python queue and one render scheduler.
  - icon: 🧪
    title: Laboratory
    details: "The "Manim 渲染" page in the left navigation is the laboratory: run 19 groups / 236 corpus entries one by one, or write code freely — it also serves as the plugin's manual acceptance page."

---

## Getting Started

Install the plugin into DeepSeek Harness desktop, then say in a session "用 Manim 画一个单位圆" (draw a unit circle with Manim) — once the AI generates the Python code, an animation card appears in the chat stream and rests on the final frame after playback.

For installation methods, required runtime environment, and network behavior, see [Installation](/en/guide/installation); for playback rules, code viewing, and mp4 export, see [Usage in Chat](/en/guide/usage).

## All Sections

| Section | Content |
| --- | --- |
| [Installation](/en/guide/installation) | Installing the plugin, bundled assets (Pyodide / KaTeX), which features need network or local tools |
| [Usage in Chat](/en/guide/usage) | How cards come into being, auto-playback rules, manual playback, mp4 export |
| [Laboratory](/en/guide/lab) | The regression suite of 236 corpus entries: how to run, turbo mode, pass criteria |
| [Settings Panel](/en/guide/settings) | Local environment probing and Python package cache management |
| [Third-party Plugin Integration](/en/guide/integrating) | The `manim` service: `check(python)` dry-run pre-check + `createSurface(container)` canvas creation |
| [Development & Debugging](/en/dev/) | For this plugin's developers: build, tests, development installation, troubleshooting entry points |
