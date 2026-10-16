# Installation

## Prerequisites

DeepSeek Harness desktop. The runtime assets (Python runtime and formula fonts) ship with the plugin, so no local Python or other dependency is required.

## Install

Pick one command in the host's plugin management:

| Method | Command |
| --- | --- |
| From a tarball | `dsh plugin add ./dsh-manim-card-<version>.tgz` |
| From the GitHub repository | `dsh plugin add github:snowowowo/dsh-manim-card` |

After installing, refresh the host page: a "Manim Card" section appears in Settings.

## Network

The first render fetches the runtime assets into the browser (about 13 MB); afterwards everything works offline. When the code uses a third-party library that is not bundled (such as `import pandas`), it is fetched over the network once and then cached locally.

## Uninstall

Uninstall through the host's plugin management. The cache directory `~/.dsh/cache/manim-live/pyodide/` lives outside the plugin directory and is not removed; delete it by hand to reclaim the space.
