# Development & Debugging

This page is for developers of this plugin: source layering, build, tests, development-time installation, how the core package dependency is managed, and troubleshooting entry points. Regular users should see [Installation](/en/guide/installation).

## Common commands

```bash
pnpm build      # tsdown build artifact (client.js)
pnpm watch      # tsdown --watch
pnpm test       # vitest (offline test cases)
pnpm test:net   # networked cases (MANIM_NET=1, timeout relaxed to 5 minutes)
pnpm gen-skill  # scripts/gen-skill.mjs, generates the corpus skill
pnpm docs:build # build the docs site (docs/ has its own dependencies and lockfile)
```

## Source layering

| Location | What it is | Build |
| --- | --- | --- |
| `src/client/` | The browser half: cards, Laboratory, Settings panel, the cross-plugin service | Bundled into `client.js` |
| `src/host/` | The host half: tool registration, asset routes, local environment probing, export | Plain JS, no build step, published as-is |
| `src/routes.js` | The single source of truth for the two asset routes (Pyodide / KaTeX) | — |
| `assets/` | Bundled assets (pyodide / katex) | Published as-is |
| `skills/manim-live/` | The domain skill body for the model (Markdown) | Published as-is |
| `docs/` | The docs site (VitePress), unrelated to the plugin's dependency graph | Built separately |

This plugin has exactly **one** build artifact, `client.js`. The real rendering and execution machinery comes from the core package `manim-live`, inlined into that artifact by the build preset; the host half does not go through tsdown at all, so editing those files takes effect directly.

`src/routes.js` is the single source of truth for the two asset routes: both the Host route registration and the fetch roots the client half passes to the core package read from it. Changing one and forgetting the other shows up as "Pyodide stuck loading" or "formulas turned into tofu", and only on a real machine — which is why `src/client/service.test.ts` asserts against the constants instead of copying the literals a second time.

## Tests

Unit tests sit next to their source files (`*.test.ts`); `pnpm test` runs the offline tier. Three divisions of labour worth knowing:

- `src/client/service.test.ts` pins the **cross-plugin contract** (service surface shape, the two route constants, status being forwarded rather than recomputed);
- `src/client/runtime-status.test.ts` pins the **pure selectors** (status → tone, pending hints, actionability), driven by a fake translate function and touching neither the DOM nor render output;
- `src/client/i18n.test.ts` is a **missing-copy regression net**: a misspelled key or a mismatched placeholder is reported on the spot, naming the source file that uses it.

Real runtime behaviour (Pyodide, the manim adaptation layer, the supported surface) is covered by the core package's own suite, not by this repository.

## Development-time installation into the host

The npm publishing and GitHub direct-install paths have not yet been verified (see the tip in [Installation](/en/guide/installation)). The development-time setup installs via **a symlink inside the profile plus a `cordis.patch.yml` entry**: symlink this repository into the plugins directory of `~/.dsh/profiles/desktop/`, and add a line for this plugin to that profile's `cordis.patch.yml`. HMR then takes effect, and after changing code, `pnpm build` hot-reloads the host side.

Refresh the host page before verifying: HMR may not re-attach unloaded slots (especially the settings section).

## The core package dependency

The core package is depended on by **version** (`manim-live: ^0.2.0`), not by a local `link`, so it can be kept aligned with the published release at any time:

```bash
pnpm add manim-live@latest   # or edit the version in package.json, then pnpm install
pnpm build                    # re-inline into client.js
```

If `pnpm link` was ever used to point at a local core-package checkout, `node_modules/manim-live` is a symlink and changing the version number does nothing — run `pnpm unlink manim-live` first, then `pnpm install`; `pnpm-lock.yaml` should go from `link:../manim-live` to a concrete version.

## Troubleshooting entry points

- **Artifact load failure / `duplicate factory registration`**: first check that the client bundle's registration id equals the package name. It is derived from `package.json` by `tsdown.preset.ts`, never handwritten.
- **Nothing renders**: the real rendering and execution machinery lives in the core package [manim-live](https://github.com/snowowowo/manim-live) ([docs site](https://snowowowo.github.io/manim-live/)), whose troubleshooting and development pages are more detailed than this one. Start with the pending items the Laboratory status bar reports — environment causes are all there.
- **Environment status empty or permanently "not loaded"**: check whether a second copy of the core package has been pulled in. Status must come through the service surface, or from this plugin's own copy of `manim-live`, see [API Reference](/en/api/#why-status-must-go-through-the-service).
- **Formulas turned into tofu**: check the KaTeX route in `src/routes.js` and whether `assets/katex/` is complete.

## Boundaries and conventions

- Corpus regression belongs to the core package repository (`corpus/`). This plugin's Laboratory only verifies its own features, with samples built into `src/client/samples.ts`, copied verbatim from the core package's corpus files; pick new ones over there.
- The single source of conventions and rules is the container repository `dsh-plugins`'s `AGENTS.md` and `.agents/skills/`; this page only points to them.
- The docs site's two languages differ only in language, never in content: a change to Chinese must be mirrored in English, see `docs/README.md`.
