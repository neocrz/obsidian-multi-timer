/** Stable public identifiers. Changing these is a breaking change. */

export const PLUGIN_ID = 'multi-timer';

export const VIEW_TYPE = 'multi-timer-view';

export const RIBBON_ICON = 'timer';

export const COMMAND_IDS = {
	open: 'open-timers',
} as const;

/** How often the plugin recomputes running timers. Display resolution is still seconds. */
export const TICK_INTERVAL_MS = 250;

/** Debounce for writing timer state to Obsidian's plugin data file. */
export const SAVE_DEBOUNCE_MS = 300;

/** Largest duration a timer can be created with: 99:59:59. */
export const MAX_HOURS = 99;

export const MAX_NAME_LENGTH = 80;

export const DEFAULT_TIMER_NAME = 'Timer';

/** Version of the persisted `data.json` shape. */
export const DATA_VERSION = 1;
