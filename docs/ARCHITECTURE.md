# Architecture

## Goals

1. **Accurate parallel timing.** Each timer uses an absolute deadline, so background throttling and
   app restarts do not drift the countdown.
2. **Testable domain.** Timer state, duration carry, formatting, and reordering are pure TypeScript
   modules with no Obsidian or DOM imports.
3. **Safe collaboration.** Small modules, stable IDs, versioned persistence, tests, and explicit
   invariants let humans and AI agents change one layer without breaking the others.
4. **Offline and asset-free.** No network calls, no audio files, no telemetry.

## Layer diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Obsidian shell                                                      │
│  main.ts ── right-sidebar view, commands, ticker, persistence        │
│      │                                                              │
│      ├── ui/timer-view.ts ── ItemView shell, layout, drag/drop       │
│      │        ├── ui/timer-form.ts                                  │
│      │        ├── ui/timer-card.ts                                  │
│      │        └── ui/settings-tab.ts                                │
│      │                                                              │
│      ├── audio/chime.ts ── Web Audio chime                          │
│      ├── storage.ts ── load/serialize versioned data                │
│      └── core/timer-store.ts ── state machine, events, snapshots    │
│               ├── core/duration.ts                                  │
│               └── core/reorder.ts                                   │
└─────────────────────────────────────────────────────────────────────┘
                         pure, no `obsidian` imports
┌─────────────────────────────────────────────────────────────────────┐
│ core/*  types.ts  settings.ts                                       │
└─────────────────────────────────────────────────────────────────────┘
```

`settings.ts` is pure. `storage.ts` is pure but imports settings and constants. UI/audio/main are
Obsidian-aware.

## Domain model

```ts
type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

interface Timer {
	id: string;
	name: string;
	durationMs: number;
	remainingMs: number; // authoritative only when not running
	status: TimerStatus;
	endAt: number | null; // epoch ms, authoritative when running
}
```

### State transitions

| From     | Action           | To        | Notes                               |
| -------- | ---------------- | --------- | ----------------------------------- |
| idle     | start            | running   | `endAt = now + durationMs`          |
| running  | pause            | paused    | `remainingMs = max(0, endAt - now)` |
| running  | deadline reached | finished  | finish event; remaining 0           |
| paused   | start / resume   | running   | `endAt = now + remainingMs`         |
| finished | start / restart  | running   | resets to full `durationMs`         |
| any      | reset            | idle      | full duration, `endAt = null`       |
| any      | delete           | (removed) | no further events                   |

If pause happens at the deadline before the next tick, the timer is finalized and the finish event is
still emitted, so the chime is not lost.

## Timekeeping

One plugin-level interval (`TICK_INTERVAL_MS`, 250 ms) calls `TimerStore.tick()`. There is never one
interval per timer. A tick only mutates timers that crossed zero; display math derives from `endAt`.
The 250 ms cadence keeps the progress bar and displayed second responsive without high CPU cost.

`remainingMsFor()` and `progressFor()` are shared by the store and card renderer so the UI cannot
drift from the domain rules.

## Data flow

### Adding a timer

1. The form reads hours/minutes/seconds and calls `normalizeDurationInput()`.
2. Overflow carries upward (`120s → 2m`, `90m → 1h30m`) and the normalized values are written back
   into the input fields.
3. The form submits milliseconds to `TimerStore.add()`, which rejects zero/invalid durations.
4. `change` fires; the view rebuilds only the list, leaving the form intact.

### Editing and controlling timers

- Rename commits on blur or Enter. The card stays in the DOM; the store normalizes whitespace and
  clamps the name length.
- Start/pause/reset/delete mutate the store. The view reconciles existing cards in place for
  status-only changes, which preserves keyboard focus and avoids losing the click that triggered the
  change after a name edit.
- Add/delete/reorder change the ID sequence, so the view rebuilds the card list.

### Finishing

1. `tick()` marks a running timer finished and emits `tick`, `change`, then `finish`.
2. `main.ts` shows a notice (if enabled), plays the chime (if enabled), and schedules a save.
3. The card updates to **Finished**, its display shows `00:00:00`, and the primary button becomes
   **Restart**.

### Persistence

- Every state mutation calls `scheduleSave()` with a 300 ms debounce. Ticks do not save.
- `TimerStore.snapshot()` computes the current remaining time for running timers but keeps `endAt`.
- `serializePluginData()` writes `{ version, timers, settings }`.
- On load, `TimerStore.load()` normalizes every record, drops invalid/duplicate IDs, and turns
  expired running timers into finished ones without firing finish effects.

See [DATA-FORMAT.md](DATA-FORMAT.md) for the exact shape.

## UI structure

`TimerView` is a single right-sidebar `ItemView`:

- **Header:** title, timer/running summary, settings button.
- **Form:** three number fields, carry hint, `+ Timer` button.
- **List:** vertically stacked cards with drag handle, editable name, status pill, `HH:MM:SS`
  display, progress bar, and primary/reset/delete controls.
- **Empty state:** guides the user to the form.

The view builds the form once. It subscribes to `change` and `tick`; changes reconcile cards, ticks
only update clocks/progress. The name element is skipped while focused. This is the key to avoiding
focus loss and swallowed clicks.

### Drag and drop

`TimerCard` sets `draggable` on the card, but `TimerView` refuses to start a drag from a button,
input, or contenteditable name. During `dragover`, the view finds the nearest non-dragged card,
chooses `before`/`after` from the pointer's vertical midpoint, and paints an insertion line. On drop
it calls `TimerStore.reorder()`. `src/core/reorder.ts` implements the deterministic move and is unit
tested.

HTML5 drag and drop is desktop-first. Touch users can still create, rename, control, and delete
timers; reordering on touch devices is a future enhancement.

## Audio

`ChimePlayer` lazily creates one `AudioContext` after a user gesture (`pointerdown` in the view, add,
start, or test sound). The completion sound is a two-pass A5/C#6/E6 sine arpeggio with a short
exponential envelope. No audio assets are loaded. If the browser blocks audio before any gesture, the
visual finish state and notice still work.

## Error handling

- Invalid durations are rejected before store mutation.
- Corrupt persisted records are dropped individually; the rest of the list still loads.
- Save failures are logged; the plugin does not crash the timer loop.
- A running record with a missing `endAt` is downgraded to `paused` rather than finishing instantly.

## Extension points

- **New control:** add a callback in `TimerCardCallbacks`, implement it in `TimerView`, wire the store.
- **New state:** extend the domain first, test transitions, then update labels/styles.
- **New persistence field:** bump `DATA_VERSION`, normalize tolerantly, document and test.
- **New settings:** update `settings.ts`, both settings renderers, and control value mapping.
- **New reorder input:** feed `reorderItems()`; do not reorder the DOM independently of the store.

## Deliberate scope boundaries (v0.1)

- No repeating/interval timers, alarms at absolute clock times, or Pomodoro automation.
- No per-timer colors, notes, or tags.
- No touch drag-to-reorder.
- No sync beyond Obsidian's own plugin-data sync.
- No sound asset selection; one generated chime with volume control.
