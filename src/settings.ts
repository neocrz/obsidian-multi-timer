export interface TimerSettings {
	soundEnabled: boolean;
	/** 0..1 */
	soundVolume: number;
	notifyOnFinish: boolean;
}

export const DEFAULT_SETTINGS: TimerSettings = {
	soundEnabled: true,
	soundVolume: 0.6,
	notifyOnFinish: true,
};

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function clampVolume(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.soundVolume;
	return Math.min(1, Math.max(0, value));
}

/** Merge persisted settings with defaults and coerce invalid values. */
export function normalizeSettings(raw: unknown): TimerSettings {
	const data = raw && typeof raw === 'object' ? (raw as Partial<TimerSettings>) : {};

	return {
		soundEnabled: booleanOrDefault(data.soundEnabled, DEFAULT_SETTINGS.soundEnabled),
		soundVolume: clampVolume(data.soundVolume),
		notifyOnFinish: booleanOrDefault(data.notifyOnFinish, DEFAULT_SETTINGS.notifyOnFinish),
	};
}
