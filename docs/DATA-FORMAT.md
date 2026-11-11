# Plugin data format

Multi Timer stores everything in Obsidian's plugin data file:

```
<Vault>/.obsidian/plugins/multi-timer/data.json
```

The file is written by `saveData()` and read by `loadData()`. It contains both settings and the
timer list so the whole workspace restores together.

## Shape (version 1)

```json
{
	"version": 1,
	"timers": [
		{
			"id": "1b2c3d4e-....",
			"name": "Tea",
			"durationMs": 180000,
			"remainingMs": 120000,
			"status": "running",
			"endAt": 1762780000000
		},
		{
			"id": "5f6a7b8c-....",
			"name": "Focus",
			"durationMs": 1500000,
			"remainingMs": 900000,
			"status": "paused",
			"endAt": null
		}
	],
	"settings": {
		"soundEnabled": true,
		"soundVolume": 0.6,
		"notifyOnFinish": true
	}
}
```

## Fields

| Path                      | Type           | Meaning                                                                        |
| ------------------------- | -------------- | ------------------------------------------------------------------------------ |
| `version`                 | number         | Persisted schema version. Current value: `1`.                                  |
| `timers`                  | array          | Ordered list; array order is the sidebar order.                                |
| `timers[].id`             | string         | Stable identifier used by the UI and store. Invalid/duplicate IDs are dropped. |
| `timers[].name`           | string         | Display name. Whitespace is collapsed and trimmed; empty becomes `Timer`.      |
| `timers[].durationMs`     | number         | Full configured duration in milliseconds, clamped to `99:59:59`.               |
| `timers[].remainingMs`    | number         | Remaining time snapshot. Authoritative for `idle`/`paused`, not `running`.     |
| `timers[].status`         | string         | `idle`, `running`, `paused`, or `finished`.                                    |
| `timers[].endAt`          | number \| null | Epoch milliseconds. Authoritative deadline for `running`; null otherwise.      |
| `settings.soundEnabled`   | boolean        | Play the completion chime.                                                     |
| `settings.soundVolume`    | number         | `0..1`, normalized on load.                                                    |
| `settings.notifyOnFinish` | boolean        | Show an Obsidian notice when a timer finishes.                                 |

## Status semantics

- **idle** — full duration remains; `endAt` is null.
- **running** — `endAt - now` is the remaining time. `remainingMs` is only a snapshot for debugging
  and for interrupted saves.
- **paused** — `remainingMs` is authoritative; `endAt` is null.
- **finished** — `remainingMs` is 0; `endAt` is null.

## Load normalization

`TimerStore.load()` is intentionally tolerant so a partial or older file still yields a usable list:

1. Non-object records, missing IDs, and non-positive durations are dropped.
2. Duplicate IDs are dropped after the first occurrence.
3. Missing/invalid names become `Timer`; names are clamped to 80 characters.
4. Unknown statuses become `idle`.
5. A `paused` record with zero remaining becomes `finished`.
6. A `running` record with a valid future `endAt` resumes with `endAt` clamped to at most one full
   duration from now.
7. A `running` record whose deadline passed becomes `finished` **without firing a finish event**.
8. A `running` record with no `endAt` becomes `paused` using its saved remaining time (or the full
   duration if that is missing).
9. Durations are clamped to the maximum of 99 hours, 59 minutes, 59 seconds.

## Save cadence

- State mutations (add, start, pause, reset, delete, rename, reorder) schedule a **300 ms debounced**
  save.
- A finish event also schedules a save.
- Ticks do not save. Running timers remain correct because their `endAt` was already persisted when
  they started.
- Unloading the plugin flushes a pending save.

## Versioning

`DATA_VERSION` lives in `src/constants.ts`. Any breaking shape change must bump it, keep
`loadPluginData()` tolerant of older shapes, and document the migration in `CHANGELOG.md`. Add
round-trip tests in `tests/storage.test.ts` and state tests in `tests/timer-store.test.ts`.
