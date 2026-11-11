# Contributing

Thanks for helping! This project is designed for human + AI collaboration. Start with
[AGENTS.md](../AGENTS.md), then read the [architecture](ARCHITECTURE.md) and
[data format](DATA-FORMAT.md) docs for the area you are changing.

## Setup

```bash
npm install
npm run typecheck
npm run test
```

Node.js 22+ is required. `npm run dev` starts an esbuild watch; `npm run build` produces `main.js`.

## Before opening a PR

```bash
npm run validate
```

This runs typecheck, ESLint, Prettier check, Vitest, and a production build. CI runs the same.

## Ground rules

- Keep `src/core/*` pure: no Obsidian imports, no DOM, no ambient clock.
- Change the pure module first and add tests before wiring UI.
- Preserve the deadline-based timing model; do not add per-timer intervals.
- Keep the form's overflow normalization (`120s → 2m`) and `noValidate` behavior.
- Bump `DATA_VERSION` and add a tolerant migration for persisted-format changes.
- Do not rebuild the whole UI for status-only changes; preserve focus while editing names.
- Never commit `main.js`, `node_modules/`, `refs/`, or coverage output.
- Update `docs/` and `CHANGELOG.md` for behavior changes.

## Manual test in Obsidian

1. `npm run build`
2. Copy `main.js`, `manifest.json`, and `styles.css` into
   `<Vault>/.obsidian/plugins/multi-timer/`.
3. Reload Obsidian (or use **Reload app without saving**), then enable **Multi Timer**.
4. Open the timer panel from the ribbon or the **Open timers** command.
5. Run through the acceptance checks in [PLAN.md](PLAN.md#verification-commands).

To inspect persistence, open `<Vault>/.obsidian/plugins/multi-timer/data.json` after adding,
renaming, reordering, pausing, and starting timers.
