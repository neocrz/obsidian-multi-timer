import { MAX_HOURS } from '../constants';

export interface TimeParts {
	hours: number;
	minutes: number;
	seconds: number;
}

export interface NormalizedTime extends TimeParts {
	totalSeconds: number;
	totalMs: number;
}

export const MAX_DURATION_SECONDS = MAX_HOURS * 3600 + 59 * 60 + 59;
export const MAX_DURATION_MS = MAX_DURATION_SECONDS * 1000;

function wholePart(value: number | string): number {
	const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return 0;
	return Math.floor(parsed);
}

/** Carry overflow upward: 120 seconds becomes 2 minutes; 90 minutes becomes 1 hour 30 minutes. */
export function normalizeTimeParts(
	hours: number | string,
	minutes: number | string,
	seconds: number | string,
): TimeParts {
	const total = Math.min(
		MAX_DURATION_SECONDS,
		wholePart(hours) * 3600 + wholePart(minutes) * 60 + wholePart(seconds),
	);

	return {
		hours: Math.floor(total / 3600),
		minutes: Math.floor((total % 3600) / 60),
		seconds: total % 60,
	};
}

export function toDurationMs(parts: TimeParts): number {
	return (parts.hours * 3600 + parts.minutes * 60 + parts.seconds) * 1000;
}

/** Normalize raw form values and convert them to a duration in one step. */
export function normalizeDurationInput(
	hours: number | string,
	minutes: number | string,
	seconds: number | string,
): NormalizedTime {
	const parts = normalizeTimeParts(hours, minutes, seconds);
	const totalSeconds = parts.hours * 3600 + parts.minutes * 60 + parts.seconds;

	return {
		...parts,
		totalSeconds,
		totalMs: totalSeconds * 1000,
	};
}

/** Clamp an arbitrary value to a usable timer duration. */
export function clampDurationMs(value: unknown): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return 0;
	return Math.min(MAX_DURATION_MS, Math.floor(parsed));
}

function pad(value: number): string {
	return value.toString().padStart(2, '0');
}

/**
 * Format a countdown as HH:MM:SS. Rounding up keeps a five-minute timer showing 00:05:00
 * until a full second has elapsed.
 */
export function formatDuration(milliseconds: number): string {
	const safe = Number.isFinite(milliseconds) && milliseconds > 0 ? milliseconds : 0;
	const totalSeconds = Math.ceil(safe / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
