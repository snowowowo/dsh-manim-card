---
layout: home

hero:
  name: dsh-manim-card
  text: Manim animations in chat
  tagline: "Say \"draw a unit circle with Manim\" and an animation card appears in the chat stream — playable, code-inspectable, exportable as video. Runtime assets ship with the plugin, so no local Python is needed."
  actions:
    - theme: brand
      text: Installation
      link: /en/guide/installation
    - theme: alt
      text: Usage in Chat
      link: /en/guide/usage
    - theme: alt
      text: GitHub
      link: https://github.com/snowowowo/dsh-manim-card

features:
  - icon: 💬
    title: Animation cards
    details: After the AI submits code, a card appears in the chat stream — one title line, a 1280×720 canvas, and three buttons on the right (play / view code / export video).
  - icon: 🩺
    title: Precheck first
    details: The code is dry-run in a real interpreter first; syntax errors and unsupported constructs come back to the model and are fixed in the same turn, so no broken card is left behind.
  - icon: 🚦
    title: One verdict everywhere
    details: Can it render, can it export — one shared reading, consistent between the Settings panel and the chat card.
---

## What a card looks like

Say "draw a definite integral with Manim" in a session: the AI submits Python through the `manim_card` tool, and a card appears in the chat stream:

![A Manim animation card in the chat stream: a title line, a 1280×720 canvas, three buttons on the right](../shots/card-preview.png)

- The top bar holds the title and three buttons (play / view code / export video); below it is the 1280×720 canvas, which rests on the final frame once playback finishes.
- Before rendering, the code is dry-run in a real interpreter; syntax errors come back to the model and are corrected in the same turn instead of turning into a blank card.

## Install

1. Install the plugin into DeepSeek Harness desktop following [Installation](/en/guide/installation);
2. Refresh the host page;
3. Say "draw a unit circle with Manim" in a session.
