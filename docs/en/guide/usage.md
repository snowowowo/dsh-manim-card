# Usage in Chat

This page covers every behavior of animation cards in the chat stream: how cards appear, when they auto-play, manual playback, viewing code, and exporting mp4. For installation see [Installation](/en/guide/installation).

## How cards come into being

Ask the AI in a session to "draw … with Manim"; the AI submits a piece of Python code through the `manim_render` tool. Before the tool returns, a dry-run pre-check executes first: syntax errors, undefined names, and unsupported constructs return immediately as an `error`, so by the time a card appears its code has already passed the pre-check. On successful rendering the card rests on the final frame; on failure, manim's original error message is shown at the bottom of the card.

## Auto-playback rules

Multiple cards may exist in the chat stream at once, and playing all of them in full is expensive, so full playback happens only in these cases:

- A **newly generated card** plays through once when it first enters the viewport.
- Any later remount (switching back to the session, refreshing the page, scrolling away and back) lands directly on the final frame without replaying.
- Cards in historical sessions do not play; they show the final frame directly.
- When the AI produces several cards in parallel within one step, only the last one plays in full.
- Scrolling a card out of the viewport does not destroy its canvas; when more than 8 canvases are active, they are reclaimed from farthest to nearest relative to the reading position (browsers cap the number of WebGL contexts).

::: warning The playback chance is consumed exactly once
The playback chance is recorded the moment it is decided: if the card scrolls out of the viewport after entering the playback queue, or playback is skipped midway, the chance is already spent — viewing it again shows the final frame, not a replay from the beginning. This design prevents repeated playback caused by scrolling.
:::

## Manual playback

The play button in the card's top bar has two states: before playback it is ▶ (play in full; takes precedence over all the automatic rules above); during playback it is ⏩ (jump straight to the final state). Interrupted cards (the turn was stopped) do not render automatically by default — press ▶ to render manually.

## Viewing the code

The Python source can be viewed directly on the card and copied to the AI for further adjustment.

## mp4 export

The download button in the card header hands the source to the locally installed manim CLI for real rendering; the mp4 is saved to the "Downloads" folder.

- **Button availability depends on the local environment**: it needs `python3` / `manim` / the manim library / `ffmpeg`; missing items are listed in the hover tooltip. LaTeX / dvisvgm are needed only for formula constructs and are not required.
- After a successful export, a "show in folder" action appears on hover; clicking it locates the file in the system file manager.
- Export records persist: after a page refresh the card still shows "last exported file", and it reports honestly even if the file has been deleted.
- For what to install locally and how to check it, see [Settings Panel](/en/guide/settings).
