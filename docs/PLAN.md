# Initial plan — Multi Timer

Date: 2026-11-11
Status: implemented and validated

## Goal

Ship a local-first Obsidian plugin that puts a multi-timer workspace in the right sidebar. The first
version must be small enough to maintain with humans and AI agents: pure timer logic, versioned
persistence, focused UI modules, tests, and documentation that explains the invariants.

## Requirements map

| User requirement                                            | Implementation                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Plugin operates in the right panel                          | `ItemView` registered as `multi-timer-view`; opened with `workspace.getRightLeaf(false)`          |
| Set timers with hours, minutes, seconds boxes and `+ Timer` | `src/ui/timer-form.ts`                                                                            |
| Input auto-adjusts overflow when adding (`120s → 2m`)       | `normalizeDurationInput()` before add; values written back; form `noValidate` avoids native `max` |
| Timers run in parallel                                      | Independent `endAt` per timer; one plugin-level ticker                                            |
| Vertical stack, reorderable by drag and drop                | `mt-list` + HTML5 drag delegation + `reorderItems()` + persisted order                            |
| Start/Resume, Reset, Delete controls                        | Card primary button (Start/Pause/Resume/Restart), Reset, Delete                                   |
| Editable name, default `Timer`                              | `contenteditable` name; blur/Enter commit; Escape cancel; normalization fallback `Timer`          |
| Generated sound when a timer ends                           | Two-pass Web Audio chime in `src/audio/chime.ts`; no audio files                                  |
| Store current setup across Obsidian restarts                | Versioned `data.json` with names, durations, order, remaining time, status, and running `endAt`   |
| Human + AI collaboration structure                          | `AGENTS.md`, `CONTRIBUTING.md`, architecture/data docs, pure modules, tests, CI, stable constants |

## Architecture decisions

1. **Deadline-based timing.** A running timer stores `endAt`. This survives browser throttling,
   background tabs, and app restarts better than decrementing a counter.
2. **One ticker.** The plugin owns a 250 ms interval. Timers are pure data and do not own intervals,
   which prevents leaks and keeps parallel behavior trivial.
3. **Pure core.** `src/core/*` has no Obsidian or DOM imports and accepts an injected clock/ID
   factory in tests.
4. **Reconcile, do not re-render everything.** The form is built once. Status changes update cards in
   place; only add/delete/reorder rebuild the list. This protects focus and fixes the blur-before-click
   race when renaming then immediately pressing a control.
5. **One versioned data object.** Timer state and settings are saved together via
   `serializePluginData()` so a future migration has one entry point.
6. **Generated chime.** Web Audio avoids bundling binary assets and keeps the plugin offline.
7. **Desktop-first drag and drop.** HTML5 DnD is reliable in Obsidian desktop. Timers remain fully
   usable on touch; touch reordering is explicitly out of scope for v0.1.

## Delivery phases

1. **Planning and tooling** — manifest, strict TypeScript, esbuild, Vitest, ESLint/Prettier, CI,
   gitignore for `refs/` and build artifacts.
2. **Pure core** — duration carry/format, reorder helper, timer store state machine, settings and
   persistence normalization, tests.
3. **Obsidian shell** — plugin lifecycle, right-sidebar view registration, single ticker, debounced
   saves, finish notices/chime.
4. **UI** — form, vertical cards, inline rename, parallel controls, drag/drop, empty state, styles.
5. **Settings** — sound/volume/notice controls with declarative definitions and classic fallback.
6. **Documentation** — README, AGENTS, architecture, data format, plan, contributing, changelog.
7. **Verification** — typecheck, lint, format check, tests, production bundle, manual install steps.

## Acceptance criteria

- [x] Right sidebar view opens from ribbon and command.
- [x] `120` seconds normalizes to `2` minutes when the field blurs or a timer is added.
- [x] Multiple timers start and count down concurrently.
- [x] Start/Resume, Reset, and Delete work per timer.
- [x] Names default to `Timer` and are editable by clicking.
- [x] Drag and drop changes vertical order and survives reload.
- [x] A generated chime and optional notice fire exactly once when a timer ends.
- [x] Timer names, order, durations, statuses, and running deadlines persist in `data.json`.
- [x] Expired running timers restore as finished; paused/idle timers restore their remaining time.
- [x] Corrupt persisted records do not prevent valid timers from loading.
- [x] `npm run validate` passes.
- [x] Docs explain architecture, data format, invariants, and how to extend the plugin.

## Verification commands

```bash
npm install
npm run validate
```

Manual checks in Obsidian after copying release artifacts:

1. Open the timer panel; confirm it lands in the right sidebar.
2. Enter `120` seconds and add a timer; confirm the card and inputs show `2` minutes.
3. Start three timers; confirm they end independently.
4. Rename one, drag the cards into a new order, and reload Obsidian; confirm names and order persist.
5. Start a long timer, close Obsidian, wait, and reopen; confirm it either resumes at the correct
   remaining time or is marked finished if the deadline passed.
6. Let a short timer finish; confirm one chime and one notice.
7. Toggle sound/notice and test volume in **Settings → Multi Timer**.

## Out of scope / future ideas

- Touch pointer-based drag sorting.
- Repeating timers, absolute-time alarms, and Pomodoro sequences.
- Per-timer colors/notes and grouping.
- Multiple named timer presets and import/export (the prototype had JSON import/export).
- Keyboard shortcuts for start/reset/delete.
- Localization.
