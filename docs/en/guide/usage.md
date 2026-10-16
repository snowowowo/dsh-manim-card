# Usage in Chat

Ask for something in a session (for example "draw a unit circle with Manim"); the AI submits a piece of Manim Python through the `manim_card` tool, and a card appears in the chat stream. Before the tool returns, the code is prechecked: syntax errors, undefined names and unsupported constructs come back to the model, which corrects them within the same turn.

## Playback rules

Several cards may exist in the chat stream at once, and playing all of them in full is expensive, so full playback happens only in these cases:

| Case | Behaviour |
| --- | --- |
| A newly generated card first enters the viewport | Plays through once |
| Any later remount (switching back, refreshing, scrolling away and back) | Lands directly on the final frame, no replay |
| Cards in historical sessions | Do not play; show the final frame |
| Several cards produced within one step | Only the last one plays in full |
| Scrolled out of the viewport | The canvas is kept; when more than 8 canvases are active they are reclaimed from farthest to nearest relative to the reading position |

::: warning The playback chance is consumed exactly once
Scrolling out of the viewport after entering the playback queue, or skipping midway, spends the chance — viewing the card again shows the final frame, not a replay from the beginning.
:::

## Manual playback

The button in the card's top bar has two states:

- **▶**: play in full. Takes precedence over all the automatic rules above.
- **⏩**: jump straight to the final state.

Interrupted cards (the turn was stopped) do not render by default; press ▶ to start. Every canvas on a page shares one execution queue, so two canvases never play at the same time.

## Viewing the code

The Python source can be read on the card and copied out to the AI for further adjustment.

## Video export

The download button in the card's top bar encodes this animation frame by frame in the browser into a video file, saved to the "Downloads" folder. It uses the same rendering engine as the card — what you see is what gets exported — and no manim, ffmpeg or LaTeX is required locally.

- Two conditions make the button available: the browser can encode frame by frame (WebCodecs or MediaRecorder), and this card has already drawn a picture. If either is missing the button is greyed out and the hover tip explains why.
- While exporting, progress appears next to the button; when it finishes, the file name is shown. The file name and format follow the encoding route actually taken (usually mp4; webm when falling back to MediaRecorder).

## When nothing can be drawn

On a render failure the card shows manim's original error message at the bottom. If a hard environment condition really is unmet, the card adds one actionable line — the same verdict the "Browser runtime" card in the Settings panel reads. Per-item states are in the [Settings Panel](/en/guide/settings#browser-runtime).
