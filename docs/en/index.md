---
layout: home

hero:
  name: dsh-manim-live
  text: Manim animations in chat
  tagline: "A DeepSeek Harness plugin: the AI writes standard Manim (Python) code in the session and a playable animation card appears right in the chat stream — replayable, code-inspectable, exportable as mp4. The code runs in the browser, so no local Python is required; the ~13 MB runtime and the formula fonts ship with the plugin, so basic figures work offline."
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
    details: After the AI submits code, a card appears in the chat stream — one title line, a WebGL canvas, and three buttons on the right (replay / view source / export mp4).
  - icon: 🩺
    title: Pre-check before presenting
    details: The code is dry-run in a real interpreter on the Node side first, so syntax errors and unsupported constructs are reported immediately; no blank or broken card is left in the chat.
  - icon: 🧪
    title: Laboratory
    details: A page under "Manim 渲染" in the left navigation — about ten built-in samples plus a free-form code box, with a pass / fail marker beside each sample.
  - icon: 🚦
    title: Environment status
    details: '"Can it render, can it export" collapsed into one reading, shared by the Laboratory status bar, the Settings panel and chat cards, with an actionable remedy for every unmet item.'
---

## What a card looks like

Say "draw a definite integral with Manim" in a session: the AI submits Python through the `manim_render` tool, and a card appears in the chat stream:

![A Manim animation card in the chat stream: a title line, a 1280×720 canvas, three buttons on the right](../shots/card-preview.png)

- The top bar holds the title and three buttons (replay / view source / export mp4); below it is the 1280×720 WebGL canvas, which rests on the final frame once playback finishes.
- The card and the Laboratory use **the same component**, so manual playback, viewing the source and export behave identically in both places.
- Before rendering, the code is dry-run in a real interpreter on the Node side; syntax errors come back to the model as `error` and are corrected in the same turn, instead of turning into a blank card.
- When the picture cannot be produced, one actionable line is added at the bottom of the card, see [Usage in Chat](/en/guide/usage#when-the-environment-falls-short).

## Install

1. Install the plugin into DeepSeek Harness desktop following [Installation](/en/guide/installation);
2. Refresh the host page;
3. Say "draw a unit circle with Manim" in a session.
