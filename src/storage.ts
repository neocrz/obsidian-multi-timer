import { DATA_VERSION } from './constants';
import type { TimerSnapshot } from './types';
import { normalizeSettings, type TimerSettings } from './settings';

export interface LoadedPluginData {
	/** Raw timer records. `TimerStore.load()` performs the state normalization. */
	timers: unknown[];
	settings: TimerSettings;
}

export interface PersistedPluginData {
	version: number;
	timers: TimerSnapshot[];
	settings: TimerSettings;
}

interface RawData {
	timers?: unknown;
	settings?: unknown;
}

/**
 * Tolerantly read plugin data. Unknown keys are ignored; malformed timer entries are dropped
 * later by the store rather than failing the whole load.
 */
export function loadPluginData(raw: unknown): LoadedPluginData {
	const data = raw && typeof raw === 'object' ? (raw as RawData) : {};
	return {
		timers: Array.isArray(data.timers) ? data.timers : [],
		settings: normalizeSettings(data.settings),
	};
}

export function serializePluginData(
	timers: readonly TimerSnapshot[],
	settings: TimerSettings,
): PersistedPluginData {
	return {
		version: DATA_VERSION,
		timers: timers.map((timer) => ({ ...timer })),
		settings: { ...settings },
	};
}
