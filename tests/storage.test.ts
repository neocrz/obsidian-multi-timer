import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings';
import { loadPluginData, serializePluginData } from '../src/storage';
import type { TimerSnapshot } from '../src/types';

const timer: TimerSnapshot = {
	id: 'timer-1',
	name: 'Focus',
	durationMs: 300_000,
	remainingMs: 120_000,
	status: 'paused',
	endAt: null,
};

describe('loadPluginData', () => {
	it('returns defaults for missing data', () => {
		expect(loadPluginData(null)).toEqual({ timers: [], settings: DEFAULT_SETTINGS });
		expect(loadPluginData('not an object')).toEqual({
			timers: [],
			settings: DEFAULT_SETTINGS,
		});
	});

	it('keeps timer records for the store to normalize', () => {
		const loaded = loadPluginData({ timers: [timer, 'broken'], settings: {} });
		expect(loaded.timers).toEqual([timer, 'broken']);
	});

	it('ignores a non-array timer field', () => {
		expect(loadPluginData({ timers: 'nope' }).timers).toEqual([]);
	});

	it('normalizes settings', () => {
		const loaded = loadPluginData({
			timers: [],
			settings: { soundEnabled: false, soundVolume: 2, notifyOnFinish: false },
		});

		expect(loaded.settings).toEqual({
			soundEnabled: false,
			soundVolume: 1,
			notifyOnFinish: false,
		});
	});

	it('clamps negative volume and replaces invalid values', () => {
		expect(loadPluginData({ settings: { soundVolume: -1 } }).settings.soundVolume).toBe(0);
		expect(loadPluginData({ settings: { soundVolume: Number.NaN } }).settings.soundVolume).toBe(
			DEFAULT_SETTINGS.soundVolume,
		);
	});
});

describe('serializePluginData', () => {
	it('writes a versioned snapshot with settings', () => {
		const data = serializePluginData([timer], DEFAULT_SETTINGS);

		expect(data).toEqual({
			version: 1,
			timers: [timer],
			settings: DEFAULT_SETTINGS,
		});
		expect(data.timers[0]).not.toBe(timer);
		expect(data.settings).not.toBe(DEFAULT_SETTINGS);
	});
});
