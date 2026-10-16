# Usage in Chat

This page covers every behaviour of animation cards in the chat stream: how cards appear, when they auto-play, manual playback, viewing code, video export, and how a card reports an unmet environment condition. For installation see [Installation](/en/guide/installation).

## How cards come into being

Ask the AI in a session to "draw … with Manim"; the AI submits a piece of Python through the `manim_card` tool. Before the tool returns, the code is dry-run once in a real interpreter on the Node side:

- Syntax errors, undefined names and constructs manim-web is measured not to support come back immediately as `error`; the model corrects by line number **within the same turn**, so no blank or truncated card is ever left in the chat;
- Only code that passes the precheck is written to the session, and the card then appears in the chat stream.

On a successful render the card rests on the final frame; on a render-time failure the card shows manim's original error message at the bottom. The tool's own contract (arguments, return, precheck boundary) is in [Host Tool](/en/api/tool).

## Auto-playback rules

Multiple cards may exist in the chat stream at once, and playing all of them in full is expensive, so full playback happens only in these cases:

| Case | Behaviour |
| --- | --- |
| A newly generated card first enters the viewport | Plays through once |
| Any later remount (switching back, refreshing, scrolling away and back) | Lands directly on the final frame, no replay |
| Cards in historical sessions | Do not play; show the final frame |
| Several cards produced in parallel within one step | Only the last one plays in full |
| Scrolled out of the viewport | The canvas is not destroyed; when more than 8 canvases are active they are reclaimed from farthest to nearest relative to the reading position (browsers cap the number of WebGL contexts) |

::: warning The playback chance is consumed exactly once
The chance is recorded the moment it is decided: if the card scrolls out of the viewport after entering the playback queue, or playback is skipped midway, the chance is already spent — viewing it again shows the final frame, not a replay from the beginning. This design prevents repeated playback caused by scrolling.
:::

## Manual playback

The play button in the card's top bar has two states:

- **▶**: play in full. Takes precedence over all the automatic rules above — including cards already judged as "land on the final frame".
- **⏩**: jump straight to the final state.

Interrupted cards (the turn was stopped) do not render automatically by default; press ▶ to render manually. Every canvas on a page shares one Python execution queue, so two canvases never play at the same time.

## Viewing the code

The Python source can be viewed directly on the card and copied to the AI for further adjustment.

## Video export

The download button in the card header **encodes this animation frame by frame in the browser** into a video file, saved to the "Downloads" folder. It uses the **very same rendering engine** as the card — what you see is what gets exported — and it never touches the local machine: no manim, ffmpeg or LaTeX to install.

- **Button availability depends on two things**: whether this page's browser can encode frame by frame (WebCodecs or MediaRecorder — without one of them there is no other export route), and whether this particular card **has already drawn a picture** (export collects the code into a timeline-backed scene on a live canvas). If either is missing the button is greyed out, and the hover tip says which one it is.
- While exporting, the button shows the core package's own progress wording ("正在把动画排进时间轴…", "逐帧编码（WebCodecs）…", "导出中 42%" and the like).
- The artefact has no on-disk path to hand back: a browser export produces a file in memory, so the receipt gives only the file name and there is no "show in folder" step; after a page refresh the card no longer shows a "last exported file".
- The format follows the encoding route actually taken (WebCodecs gives mp4, falling back to MediaRecorder gives webm), and the file name comes from the core package.
- For what to do when this page lacks frame-by-frame encoding, see [Settings Panel](/en/guide/settings#browser-runtime).

## When the environment falls short

When nothing can be drawn, the cause is usually the machine's conditions rather than the code. Cards add an actionable line in exactly those failures, worded from the same source as the plugin's Settings panel:

- one extra line below the card's error row (only when there really is a hard unmet condition; invisible in a healthy environment);
- the "Browser runtime" card in the Settings panel lists each item's state and remedy, see [Settings Panel](/en/guide/settings#browser-runtime).

Both read the same verdict, produced by the core package, so the wording never contradicts itself. To read that status in your own project, use `environmentStatus()` exported by the core package [manim-live](https://snowowowo.github.io/manim-live/).
