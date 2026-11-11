import { describe, expect, it } from 'vitest';
import {
	formatDuration,
	MAX_DURATION_MS,
	MAX_DURATION_SECONDS,
	normalizeDurationInput,
	normalizeTimeParts,
} from '../src/core/duration';

describe('normalizeTimeParts', () => {
	it('carries seconds into minutes', () => {
		expect(normalizeTimeParts(0, 0, 120)).toEqual({ hours: 0, minutes: 2, seconds: 0 });
	});

	it('carries minutes and seconds into hours', () => {
		expect(normalizeTimeParts(0, 90, 90)).toEqual({ hours: 1, minutes: 31, seconds: 30 });
	});

	it('keeps valid values unchanged', () => {
		expect(normalizeTimeParts(2, 15, 7)).toEqual({ hours: 2, minutes: 15, seconds: 7 });
	});

	it('treats invalid and negative values as zero', () => {
		expect(normalizeTimeParts(-5, 'nonsense', Number.NaN)).toEqual({
			hours: 0,
			minutes: 0,
			seconds: 0,
		});
	});

	it('clamps to the maximum duration', () => {
		expect(normalizeTimeParts(100, 0, 0)).toEqual({ hours: 99, minutes: 59, seconds: 59 });
		expect(MAX_DURATION_SECONDS).toBe(99 * 3600 + 59 * 60 + 59);
	});
});

describe('normalizeDurationInput', () => {
	it('returns both parts and milliseconds', () => {
		expect(normalizeDurationInput(0, 0, 120)).toEqual({
			hours: 0,
			minutes: 2,
			seconds: 0,
			totalSeconds: 120,
			totalMs: 120_000,
		});
	});

	it('clamps milliseconds to the maximum', () => {
		expect(normalizeDurationInput(999, 0, 0).totalMs).toBe(MAX_DURATION_MS);
	});
});

describe('formatDuration', () => {
	it('formats zero and whole seconds', () => {
		expect(formatDuration(0)).toBe('00:00:00');
		expect(formatDuration(1000)).toBe('00:00:01');
	});

	it('formats minutes and hours', () => {
		expect(formatDuration(5 * 60_000)).toBe('00:05:00');
		expect(formatDuration(3_600_000)).toBe('01:00:00');
	});

	it('rounds partial seconds up', () => {
		expect(formatDuration(1500)).toBe('00:00:02');
	});

	it('formats the maximum duration', () => {
		expect(formatDuration(MAX_DURATION_MS)).toBe('99:59:59');
	});

	it('treats invalid input as zero', () => {
		expect(formatDuration(Number.NaN)).toBe('00:00:00');
		expect(formatDuration(-100)).toBe('00:00:00');
	});
});
