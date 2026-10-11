# Development & Debugging

This page is for developers of this plugin; it covers build, tests, development-time installation, and troubleshooting. Regular users should see [Installation](/en/guide/installation).

## Common commands

```bash
pnpm build      # tsdown build artifact (client.js)
pnpm watch      # tsdown --watch
pnpm test       # vitest (offline test cases)
pnpm test:net   # networked cases (MANIM_NET=1, timeout relaxed to 5 minutes)
pnpm gen-skill  # scripts/gen-skill.mjs, generates the corpus skill
```

## Development-time installation into the host

The npm publishing and GitHub direct-install paths have not yet been verified (see the tip in [Installation](/en/guide/installation)). The current development-time setup installs via **symlink inside the profile + a `cordis.patch.yml` entry**: symlink this repository into the plugins directory of `~/.dsh/profiles/desktop/`, and add a line for this plugin to that profile's `cordis.patch.yml` — afterwards HMR takes effect, and after changing code, `pnpm build` hot-reloads the host side. Refresh the host page before verifying (HMR may not re-attach unloaded slots).

## Troubleshooting entry points

- Symptoms like artifact load failure / `duplicate factory registration`: first check that the client bundle's registration id equals the package name (derived from `package.json` by `tsdown.preset.ts`, never handwritten).
- This plugin depends on the core package [manim-live](https://github.com/snowowowo/manim-live)
  ([docs site](https://snowowowo.github.io/manim-live/)): the real rendering-and-execution machinery lives there, so debugging "nothing renders" may require crossing into the core package — its troubleshooting and development pages are more detailed than this one.
- Boundary: corpus regression belongs to the core package repository (`corpus/`); this plugin's laboratory only verifies its own features, with samples built into `src/client/samples.ts` (copied verbatim from the core package's corpus files — pick new ones over there).

The single source of conventions and rules is the container repository `dsh-plugins`'s `AGENTS.md` and `.agents/skills/`; this page only points to them.
