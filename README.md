# Multi Timer for Obsidian

Independent countdown timers in the right sidebar. Create several timers, run them in parallel,
rename them, drag them into any order, and keep the layout after restarting Obsidian.

## Features

- **Right-sidebar timer panel.** Open it from the ribbon timer icon or the **Open timers** command.
- **Hours / minutes / seconds input.** Overflow is carried automatically: `120` seconds becomes
  `2` minutes, and `90` minutes becomes `1` hour `30` minutes. The same normalization happens when
  the input loses focus and when a timer is added.
- **Parallel timers.** Every timer owns its own deadline, so timers do not block each other.
- **Vertical, drag-to-reorder list.** Drag a card by its grip handle (or any non-interactive part of
  the card) to reorder. The order is saved.
- **Start / pause / resume, reset, delete.** The primary button follows the state: **Start**,
  **Pause**, **Resume**, or **Restart**. **Reset** restores the full duration. **Delete** removes
  the timer.
- **Editable names.** Click a timer name to edit it. **Enter** commits, **Escape** cancels, and an
  empty name falls back to **Timer**.
- **Generated completion chime.** A two-pass Web Audio chime plays when a timer ends. No audio files
  are bundled.
- **Saved state.** Timer names, durations, order, remaining time, and running deadlines are stored
  in the plugin's `data.json`. Running timers keep counting against wall-clock time after a restart.
- **Settings.** Toggle the chime, adjust volume, play a test sound, and toggle finish notices.

## Install (manual)

1. Clone this repository.
2. Run `npm install` and `npm run build`.
3. Copy `main.js`, `manifest.json`, and `styles.css` into
   `<Vault>/.obsidian/plugins/multi-timer/`.
4. Enable **Multi Timer** in **Settings → Community plugins**.

For development, run `npm run dev` to rebuild on change.

## Usage

1. Enter a duration in the hours, minutes, and seconds boxes.
2. Select **+ Timer**.
3. Use **Start** to run it. Add more timers whenever you need them; they run independently.
4. Click a name to rename it. Drag the grip handle to change the order.
5. When a timer reaches zero, it is marked **Finished**, the chime plays, and a notice appears. Use
   **Restart** to run it again or **Reset** to return it to its full duration.

The timer panel remembers its sidebar position through Obsidian's normal workspace layout. The timer
list itself survives plugin reloads and restarts.

## How restart recovery works

Running timers store an absolute end time (`endAt`) rather than a decrementing counter. If Obsidian
closes while a timer is running, the time that passes while the app is closed still counts. A timer
whose end time passed while Obsidian was closed is restored as **Finished** when the plugin loads.

Paused and idle timers restore their remaining time exactly.

## Development

```bash
npm install
npm run dev          # esbuild watch
npm run typecheck    # tsc --noEmit
npm run test         # Vitest
npm run lint         # ESLint + obsidianmd rules
npm run format       # Prettier
npm run validate     # typecheck + lint + format check + tests + production build
```

Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Data format:
[docs/DATA-FORMAT.md](docs/DATA-FORMAT.md) · Initial plan:
[docs/PLAN.md](docs/PLAN.md) · Agent guide: [AGENTS.md](AGENTS.md) · Contributing:
[CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy

The plugin is fully offline. It stores timer configuration in Obsidian's plugin data, does not read
vault notes, makes no network requests, and ships no telemetry.

## License

MIT
