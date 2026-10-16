# Development & Debugging

This page is for developers of this plugin: tech stack, directory layout, development flow, tests, and troubleshooting entry points. Readers who only use the plugin should start at [Installation](/en/guide/installation) and [Usage in Chat](/en/guide/usage).

## Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Language | TypeScript 7 | Source is `.ts` / `.tsx`; `tsconfig.json` only type-checks (`noEmit`), tsdown produces the output |
| Build | tsdown + the in-repo build preset | Exactly one artifact, `client.js`; the preset is `tsdown.preset.ts`, carried by every plugin repository and byte-identical across them |
| UI | React 18 (provided by the host) | Declared in `peerDependencies` — **not bundled, not version-pinned**; host base words are externalized at build time and resolved by the host at runtime |
| Styles | Tailwind CSS 4 | CSS is generated at build time through postcss + lightningcss and injected as `<style data-plugin>`, scoped, without preflight |
| Icons | lucide-react | Named imports, never the whole package |
| Code highlighting | shiki + `@shikijs/langs` | Used when viewing the Python source on a card |
| Runtime and rendering | Core package `manim-live` `^0.3.0` | Python execution and the WebGL canvas come from it, **inlined** into `client.js` at build time |
| Tests | Vitest 5 + v8 coverage | Tests sit beside the file under test, named `*.test.ts` |
| Package manager | pnpm | The only lockfile is `pnpm-lock.yaml` |

## Directory layout

```
index.js            Host entry: re-exports src/host/index.js only, decoupling the entry path from the layout
client.js           Client bundle artifact (build output, committed with the package)
cordis.patch.yml    This plugin's registration entry in a host profile
src/
├── client/         Browser half — all of it is bundled into client.js
│   ├── index.tsx       Entry: ModuleLoader registration + slot wiring + ErrorBoundary
│   ├── renderer.ts     The one Manim renderer per page: the core package's factory is wired to this plugin's routes here
│   ├── settings.tsx    Settings panel
│   ├── components/     UI pieces: card, code view, status dot, hover tip
│   ├── definition.ts   Session folding definition: one manim_card call = one render card
│   ├── render-queue.ts Render scheduling: which card runs now, how many canvases stay alive
│   ├── runtime-status.ts  Environment status → display wording (pure selectors)
│   ├── clipboard.ts    Copying source: clipboard API first, execCommand as fallback
│   ├── code-highlight.ts  Python highlighting via shiki
│   ├── export.ts       Export implementation (withdrawn from the UI, currently uncalled — see its file header)
│   ├── environment.ts / packages.ts
│   │                   Two fetch layers: the core package's environment-probe / package-manager clients bound to this plugin's routes
│   ├── i18n.ts         Copy dictionary
│   └── styles.css      Skin
├── host/           Host half — plain JS, no build step, published as-is
│   ├── index.js        apply assembly: tool registration, asset routes, the skill
│   ├── environment.js  Local environment probing (route still registered, UI no longer calls it — see below)
│   ├── export.js       Local CLI export (same)
│   └── pyodide.js / assets.js / http.js   Asset and on-demand package-fetch routes
└── routes.js       Single source of truth for every HTTP route, shared by both halves
assets/             Bundled assets: pyodide / katex
scripts/gen-skill.mjs  Generates the domain skill body for the model
skills/manim-card/  The skill body (Markdown, produced by the script above)
docs/               The docs site (VitePress, its own dependency, unrelated to the plugin's dependency graph)
```

(`*.test.ts` files sit beside the file under test and are not listed here.)

This repository has only **two halves, client and host** — there is no third shared area. Constants both halves need live in `src/routes.js`; heavy shared machinery (the Python runtime, rendering) belongs to the core package.

`src/routes.js` is the single source of truth for **every** HTTP route of this plugin: six constants (KaTeX and Pyodide as two prefix-style file routes, plus four interface routes — packages / cache / environment / export, which together expose eight countable endpoints). The paths the Host registers, the fetch roots the client half passes to the core package, and the fetch addresses of the fetch layers all read from it. Changing one and forgetting the other shows up as "Pyodide stuck loading" or "formulas turned into tofu", and only on a real machine — which is why `src/client/renderer.test.ts` asserts against the constants instead of copying the literals a second time.

::: info Why the two local-machine routes are still there
**Export has been withdrawn from the UI entirely** (user decision, 2026-10-17): the card's button, its copy and its receipt rows are gone. `src/client/export.ts` (real-time canvas recording — verified in a real browser to capture animation that actually moves) and `src/client/environment.ts` both **stay in place with no caller**; the local `environment` / `export` Host routes likewise (withdrawn even earlier). To restore it, wire `card.tsx` back up and re-add the `export*` i18n keys (the key list is in `src/client/export.ts`'s file header). The routes and the probing remain covered by `src/host/routes.test.ts` — deleting code is not a prerequisite.
:::

What ships is decided by `files` in `package.json`: `index.js` / `client.js` / `src` / `assets` / `skills` / `cordis.patch.yml`. `docs/` is not part of the package.

## Setting up the development environment

```bash
git clone https://github.com/snowowowo/dsh-manim-card.git
cd dsh-manim-card
pnpm install
pnpm build       # produces client.js
```

Installing into the host uses **a symlink inside the profile plus a `cordis.patch.yml` entry**: symlink this repository into the plugins directory of `~/.dsh/profiles/desktop/`, and add a line for this plugin (the `insert` entry in this repository's own `cordis.patch.yml`) to that profile's `cordis.patch.yml`. HMR then takes effect, and the host side hot-reloads after a code change.

The npm publishing and GitHub direct-install paths have not yet been verified, see [Installation](/en/guide/installation).

## Development flow

```bash
pnpm watch      # tsdown --watch: rebuild client.js on every change under src/client
pnpm build      # build the client.js artifact
pnpm test       # vitest (offline test cases)
pnpm test:net   # networked cases (MANIM_NET=1, timeout relaxed to 5 minutes)
pnpm coverage   # coverage (v8, src only)
pnpm gen-skill  # scripts/gen-skill.mjs: generate the domain skill for the model
pnpm docs       # start the docs site locally
```

A typical change goes through these steps:

1. **Decide which half you are changing.** `src/client/**` must be rebuilt to take effect; `src/host/**` is plain JS and takes effect as soon as the file is saved, with no build.
2. For the client half, run `pnpm watch` (or `pnpm build` once when done).
3. **Refresh the host page** before checking the result — HMR may not re-attach unloaded slots (especially the settings section).
4. `pnpm test`; for changes touching on-demand package fetching, the real runtime, or network behaviour, run `pnpm test:net`.
5. When you touch the package name or the entry, confirm the client bundle's **registration id still equals the package name** — it is derived from `package.json` by `tsdown.preset.ts`, never handwritten.

## Tests

Unit tests sit next to their source files (`*.test.ts`); `pnpm test` runs the offline tier. Five divisions of labour worth knowing:

- `src/host/routes.test.ts` runs `apply()` for real against a fake ctx: the tool, the skill, the standing guide, and the registration and behavioural boundary of every asset and interface route all live in this one file;
- `src/client/renderer.test.ts` pins the **renderer wiring** (the two asset addresses come from `src/routes.js`, and exactly one renderer exists per page);
- `src/client/runtime-status.test.ts` pins the **pure selectors** (status → tone, pending hints, actionability), driven by a fake translate function and touching neither the DOM nor render output;
- `src/client/export.test.ts` pins **recording export** (withdrawn from the UI, but the implementation stays under test): the capability verdict looks only at `MediaRecorder` plus a usable MIME, the upstream exporter is never touched, start and stop come in pairs (the timeline is disposed and the recorder stopped on either outcome), and a zero duration is reported honestly — all with stand-ins, never real encoding;
- `src/client/i18n.test.ts` is a **missing-copy regression net**: a misspelled key or a mismatched placeholder is reported on the spot, naming the source file that uses it.

Real runtime behaviour (Pyodide, the manim adaptation layer, the supported surface) is covered by the core package's own suite, not by this repository.

## The core package dependency

The core package is depended on by **version** (`manim-live: ^0.3.0`), not by a local `link`, so it can be kept aligned with the published release at any time:

```bash
pnpm add manim-live@latest   # or edit the version in package.json, then pnpm install
pnpm build                    # re-inline into client.js
```

If `pnpm link` was ever used to point at a local core-package checkout, `node_modules/manim-live` is a symlink and changing the version number does nothing — run `pnpm unlink manim-live` first, then `pnpm install`; `pnpm-lock.yaml` should go from `link:../manim-live` to a concrete version.

## Troubleshooting entry points

- **Artifact load failure / `duplicate factory registration`**: first check that the client bundle's registration id equals the package name. It is derived from `package.json` by `tsdown.preset.ts`, never handwritten.
- **Nothing renders**: the real rendering and execution machinery lives in the core package [manim-live](https://github.com/snowowowo/manim-live) ([docs site](https://snowowowo.github.io/manim-live/)), whose troubleshooting and development pages are more detailed than this one. Environment causes are all listed in the Settings panel's "Browser runtime" card.
- **Environment status empty or permanently "not loaded"**: check whether a second copy of the core package has been pulled in. Status must come from this plugin's own copy of `manim-live` — this plugin provides no Cordis service, so there is no service surface to go through, see [API Reference](/en/api/#no-cordis-service-is-provided).
- **Formulas turned into tofu**: check the KaTeX route in `src/routes.js` and whether `assets/katex/` is complete.

## Three parties, three jobs

From "AI writes code" to "an animation in the chat", three parties each own one stretch:

| Party | Owns | Does not own |
| --- | --- | --- |
| The host | The conversation and chat stream, the slot and service systems, invocation and logging of `manim_card` | Rendering, Manim syntax |
| Core package [manim-live](https://snowowowo.github.io/manim-live/) | Python execution in the browser, the manim adaptation layer, the WebGL canvas, environment status verdicts | Host integration, card UI, asset routes |
| This plugin | Host integration (routes, tool, slots), cards and playback scheduling, the Settings panel | Rendering and execution themselves |

One difference from native Manim is worth remembering: the code is the same standard Manim Python, but execution happens in Pyodide inside the browser and the rendering engine is manim-web (not CE's Cairo pipeline). The usable surface is the common subset of Manim CE; coverage and gaps follow the core package's [Support Surface](https://snowowowo.github.io/manim-live/en/guide/support).

## Boundaries and conventions

- Corpus regression belongs to the core package repository (`corpus/`); to pick or add samples, go over there.
- The build preset `tsdown.preset.ts` has its single source in the `dsh-plugin-template` repository and is byte-identical across plugin packages; change the preset in the template first, then copy the whole file over.
- The single source of conventions and rules is the container repository `dsh-plugins`'s `AGENTS.md` and `.agents/skills/`; this page only points to them.
- The docs site's two languages differ only in language, never in content: a change to Chinese must be mirrored in English, see `docs/README.md`.
