# What It Is

dsh-manim-card adds one animation card to DeepSeek Harness: the AI writes standard Manim (Python) code in a session, and a playable, code-inspectable, video-exportable card appears right in the chat stream. The code runs in the browser, so no local Python is required.

| Where it lands | What |
| --- | --- |
| Chat stream | Animation cards: manual play, code viewing, video export |
| A tool | `manim_card`: the AI submits Manim Python, which is prechecked before the call returns |
| Settings | A "Manim Card" section: browser runtime status and the local library list |

The rendering engine and the Python runtime come from the core package [manim-live](https://snowowowo.github.io/manim-live/) and are installed together with this plugin; nothing else needs configuring.
