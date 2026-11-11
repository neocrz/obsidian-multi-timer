# Changelog

All notable changes to this project are documented here. Format based on Keep a Changelog; versions
follow SemVer.

## [0.1.0] - 2026-11-11

### Added

- Right-sidebar **Timers** view with ribbon icon and **Open timers** command.
- Hours/minutes/seconds form with automatic overflow carry (`120s → 2m`, `90m → 1h30m`).
- Independent parallel timers using absolute deadlines and one shared 250 ms ticker.
- Vertical timer stack with drag-to-reorder; order is persisted.
- Start/pause/resume/restart, reset, and delete controls per timer.
- Click-to-rename timer names with Enter/Escape handling and a `Timer` fallback.
- Generated two-pass Web Audio completion chime with enable/volume settings and a test button.
- Optional finish notice.
- Versioned `data.json` persistence for names, durations, order, status, remaining time, running
  deadlines, and settings; expired timers restore as finished.
- Tolerant load normalization for corrupt or partial data.
- Settings tab with declarative definitions for Obsidian 1.13+ and a classic fallback renderer.
- Strict TypeScript, esbuild, Vitest, ESLint, Prettier, GitHub Actions CI.
- README, AGENTS.md, architecture, data-format, plan, contribution, and license docs.
