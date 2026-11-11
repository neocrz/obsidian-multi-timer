# AGENTS.md — working on Multi Timer

This is the shared operating manual for humans and AI agents. Read it before changing code.
`refs/` contains upstream examples and the original prototype page. It is gitignored and **must not**
be imported, copied wholesale, or treated as part of the build.

## Project overview

- **What it is:** an Obsidian community plugin that provides independent, parallel timers in the
  right sidebar.
- **Target:** TypeScript → bundled CommonJS `main.js`, loaded by Obsidian.
- **Release artifacts:** `main.js`, `manifest.json`, `styles.css`.
- **Persistence:** one versioned plugin `data.json` object containing the timer list and settings.
- **Tooling:** npm, esbuild, Vitest, ESLint (`eslint-plugin-obsidianmd`), Prettier.

## Requirements and commands

Node.js 22+ and npm are required.

```bash
npm install          # install dependencies
npm run dev          # esbuild watch mode (no typecheck)
npm run typecheck    # tsc --noEmit
npm run test         # vitest run
npm run test:watch   # vitest watch mode
npm run lint         # eslint .
npm run format       # prettier --write .
npm run format:check # prettier --check .
npm run validate     # typecheck + lint + format check + tests + production build
npm run build        # typecheck + production bundle
```

`npm run build` writes `main.js` at the project root. Copy `main.js`, `manifest.json`, and
`styles.css` into `<Vault>/.obsidian/plugins/multi-timer/` for manual testing. Never commit
`main.js`, `node_modules/`, coverage output, or `refs/`.

## Architecture at a glance

```
src/main.ts                 plugin lifecycle, sidebar opening, ticker, persistence, finish effects
src/constants.ts            stable IDs, tick/save cadence, limits, data version
src/types.ts                Timer and TimerStatus domain types
src/settings.ts             settings shape, defaults, normalization
src/storage.ts              versioned plugin-data load/serialize
src/host.ts                 narrow interfaces the view/settings tab depend on

src/core/duration.ts        input carry/normalization and HH:MM:SS formatting (pure)
src/core/reorder.ts         before/after move helper (pure)
src/core/timer-store.ts     state machine, wall-clock timing, snapshots, events (pure)

src/audio/chime.ts          synthesized Web Audio completion chime (browser-only)

src/ui/timer-view.ts        ItemView shell, form/list layout, drag/drop, tick rendering
src/ui/timer-form.ts        hours/minutes/seconds form and carry behavior
src/ui/timer-card.ts        one timer card and its button/name interactions
src/ui/settings-tab.ts      declarative settings (1.13+) with classic display() fallback

tests/                      Vitest tests for every pure module
docs/                       architecture, data format, initial plan
```

### Data flow

1. `main.ts` loads and normalizes plugin data, creates the `TimerStore`, registers the view and
   commands, and starts one plugin-level interval.
2. The interval calls `TimerStore.tick()` every 250 ms. Running timers are evaluated from their
   `endAt` deadline; timers that crossed zero become `finished` and emit a finish event.
3. The plugin plays the chime, shows an optional notice, and schedules a debounced save.
4. `TimerView` renders the form once, then reconciles the list. Structural changes (add, delete,
   reorder) rebuild cards; status/name/time changes update existing cards so focus is preserved.
5. Every state mutation schedules a save. The persisted snapshot includes `endAt` for running
   timers, so wall time survives an Obsidian restart.

## Non-negotiable invariants

1. **Timer math is pure.** `src/core/*` must not import `obsidian` or touch the DOM. Inject the clock
   and ID factory in tests. This is what makes timing testable.
2. **Deadlines, not intervals, define time.** A running timer stores `endAt` (epoch ms). Never
   decrement `remainingMs` once per second and never create one interval per timer.
3. **One ticker.** The plugin owns the only timer interval. Views may subscribe but must not start
   their own countdown intervals.
4. **Persist one versioned object.** Use `loadPluginData()` / `serializePluginData()` and update
   `DATA_VERSION` plus a migration when the shape changes. Do not save on every tick; save on
   mutations and finish events (debounced).
5. **Overflow is a feature.** `120` seconds must become `2` minutes. Keep the form's
   `noValidate = true`; native `max` validation would block this before normalization.
6. **Reconciliation preserves editing.** Do not rebuild the form. On non-structural changes, update
   card fields in place and skip the name element while it is focused.
7. **Stable identifiers are public API.** Do not casually change `VIEW_TYPE`, command IDs, plugin
   ID, or the persisted schema version.
8. **Offline and asset-free.** No network calls, telemetry, remote code, or bundled audio files. The
   chime is synthesized with Web Audio and unlocked by a user gesture.
9. **Clean up everything.** Use `register*`, `registerInterval`, and store unsubscribe functions.
   Flush a pending save on unload.
10. **Generated files stay out of git.** `main.js` and `node_modules/` are build artifacts.

## Timer state machine

```
idle ──start──▶ running ──pause──▶ paused
  ▲                │                  │
  │                │ deadline         └──start/resume──▶ running
  │                ▼
  └──reset── finished ◀──deadline/pause-after-deadline
                 │
                 └──start/restart──▶ running (full duration)
```

- `idle`: full `durationMs` remaining.
- `running`: `endAt` is authoritative; `remainingMs` is a display snapshot.
- `paused`: `remainingMs` is authoritative, `endAt` is null.
- `finished`: `remainingMs` is 0, `endAt` is null.

On load, an expired running timer becomes `finished` silently (no chime for time that elapsed while
Obsidian was closed). A running record with no `endAt` is treated as paused for safety.

## How to make a change

1. Read `docs/ARCHITECTURE.md` and `docs/DATA-FORMAT.md` when touching timer state or persistence.
2. Change the pure core first and add/adjust tests in `tests/`.
3. Wire it into the view or plugin without duplicating timer arithmetic.
4. Run `npm run validate`. Fix lint/format instead of disabling rules.
5. Update docs and `CHANGELOG.md` when behavior changes.

### Adding a timer action or state

- Update `TimerStatus` / `Timer` in `src/types.ts`.
- Update the state machine and `normalizeStoredTimer()` in `src/core/timer-store.ts`.
- Add table-driven tests in `tests/timer-store.test.ts`.
- Add the button/action in `src/ui/timer-card.ts` and wire it in `src/ui/timer-view.ts`.
- Update `docs/ARCHITECTURE.md`, `docs/DATA-FORMAT.md`, and the README if user-visible.

### Adding a settings field

- Add it to `TimerSettings` and `DEFAULT_SETTINGS` in `src/settings.ts`.
- Normalize it in `normalizeSettings()`.
- Add it to **both** `getSettingDefinitions()` and `display()` in `src/ui/settings-tab.ts`.
- Implement its `getControlValue()` / `setControlValue()` mapping.
- Add a normalization test in `tests/storage.test.ts` when coercion matters.

### Changing the persisted format

- Bump `DATA_VERSION` in `src/constants.ts`.
- Keep `loadPluginData()` tolerant of older shapes and drop only unusable records.
- Document the new fields in `docs/DATA-FORMAT.md` and the migration in `CHANGELOG.md`.
- Add round-trip and normalization tests.

### Changing drag and drop

- Keep ordering logic in `src/core/reorder.ts` and test it.
- `TimerView` only translates pointer position into `{ id, position }`.
- Do not reorder the DOM independently of the store; the store is the source of truth.

## Testing policy

- Pure modules need tests. UI and Obsidian API glue stay thin and are manually verified.
- Use fixed clocks passed to `TimerStore`; never depend on the wall clock in tests.
- Inject deterministic IDs; assert generated IDs are unique separately.
- Cover boundaries: zero duration, carry at 60, maximum duration, pause at deadline, restart after
  finish, duplicate/invalid persisted records, expired running timers, and before/after reordering.
- Run `npm run validate` before committing.

## Style

- TypeScript strict, tabs, single quotes, semicolons, trailing commas, 100 columns (Prettier).
- Prefer small files (<300 lines) and named exports. `main.ts` stays lifecycle-focused.
- Use sentence case for UI copy and Obsidian CSS variables in `styles.css`.
- Use `async/await`; surface user-visible failures with `Notice` and log diagnostics with `console.error`.
- Support light/dark themes and narrow sidebar widths.

## Reference material

`refs/` contains:

- `obsidian-sample-plugin/` — build, manifest, and lifecycle conventions.
- `obsidian-mathpad/` — right-sidebar `ItemView` and view activation patterns.
- `obsidian-spaced-repetition/` — prior art for sidebar views.
- `obsidian-anki-flashcards/` — project layout, testing, docs, and agent-workflow reference.
- `multi_timer.html` — the original prototype: timer form, parallel timers, rename, drag sorting,
  generated beep, and duration carry.

Read them for context, then implement in this project's own structure.
