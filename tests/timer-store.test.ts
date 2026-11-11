import { describe, expect, it } from 'vitest';
import { progressFor, remainingMsFor, TimerStore } from '../src/core/timer-store';
import type { Timer } from '../src/types';

function createHarness(start = 1_000_000) {
	let now = start;
	let counter = 0;
	const store = new TimerStore({
		now: () => now,
		createId: () => `timer-${++counter}`,
	});
	const finished: Timer[] = [];
	store.onFinish((timer) => finished.push(timer));

	return {
		store,
		finished,
		get now() {
			return now;
		},
		advance(milliseconds: number) {
			now += milliseconds;
		},
		setNow(value: number) {
			now = value;
		},
	};
}

describe('TimerStore creation', () => {
	it('creates idle timers with a default name', () => {
		const { store } = createHarness();
		const timer = store.add('', 5 * 60_000);

		expect(timer).toMatchObject({
			name: 'Timer',
			durationMs: 300_000,
			remainingMs: 300_000,
			status: 'idle',
			endAt: null,
		});
	});

	it('rejects zero and invalid durations', () => {
		const { store } = createHarness();
		expect(store.add('Timer', 0)).toBeNull();
		expect(store.add('Timer', -1000)).toBeNull();
		expect(store.getTimers()).toHaveLength(0);
	});

	it('normalizes names', () => {
		const { store } = createHarness();
		const timer = store.add('  Deep\n work  ', 1000);
		expect(timer?.name).toBe('Deep work');
	});

	it('generates unique ids', () => {
		const { store } = createHarness();
		store.add('One', 1000);
		store.add('Two', 1000);
		const ids = store.getTimers().map((timer) => timer.id);
		expect(new Set(ids).size).toBe(2);
	});
});

describe('TimerStore running state', () => {
	it('runs parallel timers independently', () => {
		const harness = createHarness();
		const first = harness.store.add('First', 60_000);
		const second = harness.store.add('Second', 120_000);
		expect(first && second).toBeTruthy();
		if (!first || !second) return;

		expect(harness.store.start(first.id)).toBe(true);
		expect(harness.store.start(second.id)).toBe(true);
		harness.advance(30_000);
		harness.store.tick();

		const firstNow = harness.store.getTimer(first.id);
		const secondNow = harness.store.getTimer(second.id);
		expect(firstNow?.status).toBe('running');
		expect(firstNow && remainingMsFor(firstNow, 1_030_000)).toBe(30_000);
		expect(secondNow && remainingMsFor(secondNow, 1_030_000)).toBe(90_000);

		harness.advance(30_000);
		const finished = harness.store.tick();
		expect(finished.map((timer) => timer.id)).toEqual([first.id]);
		expect(harness.store.getTimer(first.id)?.status).toBe('finished');
		expect(harness.store.getTimer(second.id)?.status).toBe('running');
		expect(harness.finished.map((timer) => timer.id)).toEqual([first.id]);

		harness.advance(60_000);
		expect(harness.store.tick()).toHaveLength(1);
		expect(harness.finished.map((timer) => timer.id)).toEqual([first.id, second.id]);
	});

	it('does not fire a finish event twice', () => {
		const harness = createHarness();
		const timer = harness.store.add('Once', 1000);
		if (!timer) throw new Error('Timer was not created');
		harness.store.start(timer.id);

		harness.advance(1000);
		harness.store.tick();
		harness.store.tick();
		harness.store.tick();

		expect(harness.finished).toHaveLength(1);
	});

	it('pauses from the wall clock and resumes the remaining time', () => {
		const harness = createHarness();
		const timer = harness.store.add('Pause me', 10_000);
		if (!timer) throw new Error('Timer was not created');

		harness.store.start(timer.id);
		harness.advance(4_000);
		expect(harness.store.pause(timer.id)).toBe(true);

		const paused = harness.store.getTimer(timer.id);
		expect(paused).toMatchObject({ status: 'paused', remainingMs: 6_000, endAt: null });

		harness.advance(100_000);
		harness.store.tick();
		expect(harness.store.getTimer(timer.id)?.status).toBe('paused');
		expect(harness.finished).toHaveLength(0);

		harness.store.start(timer.id);
		harness.advance(5_999);
		expect(harness.store.tick()).toHaveLength(0);
		harness.advance(1);
		expect(harness.store.tick()).toHaveLength(1);
		expect(harness.store.getTimer(timer.id)?.status).toBe('finished');
	});

	it('restarts a finished timer from its full duration', () => {
		const harness = createHarness();
		const timer = harness.store.add('Again', 2_000);
		if (!timer) throw new Error('Timer was not created');

		harness.store.start(timer.id);
		harness.advance(2_000);
		harness.store.tick();
		expect(harness.store.getTimer(timer.id)?.status).toBe('finished');

		harness.store.start(timer.id);
		const restarted = harness.store.getTimer(timer.id);
		expect(restarted).toMatchObject({ status: 'running', remainingMs: 2_000 });
		expect(restarted?.endAt).toBe(harness.now + 2_000);
	});

	it('resets a running timer to idle', () => {
		const harness = createHarness();
		const timer = harness.store.add('Reset', 10_000);
		if (!timer) throw new Error('Timer was not created');

		harness.store.start(timer.id);
		harness.advance(3_000);
		expect(harness.store.reset(timer.id)).toBe(true);
		expect(harness.store.getTimer(timer.id)).toMatchObject({
			status: 'idle',
			remainingMs: 10_000,
			endAt: null,
		});
	});
});

describe('TimerStore mutations', () => {
	it('renames, removes, and reorders timers', () => {
		const { store } = createHarness();
		const first = store.add('One', 1000);
		const second = store.add('Two', 1000);
		const third = store.add('Three', 1000);
		if (!first || !second || !third) throw new Error('Timers were not created');

		expect(store.rename(first.id, '  Focus  ')).toBe(true);
		expect(store.getTimer(first.id)?.name).toBe('Focus');
		expect(store.rename(first.id, 'Focus')).toBe(false);

		expect(store.reorder(third.id, first.id, 'before')).toBe(true);
		expect(store.getTimers().map((timer) => timer.id)).toEqual([third.id, first.id, second.id]);

		expect(store.remove(second.id)).toBe(true);
		expect(store.getTimer(second.id)).toBeUndefined();
		expect(store.remove(second.id)).toBe(false);
	});

	it('falls back to the default name for empty renames', () => {
		const { store } = createHarness();
		const timer = store.add('Named', 1000);
		if (!timer) throw new Error('Timer was not created');

		expect(store.rename(timer.id, '   ')).toBe(true);
		expect(store.getTimer(timer.id)?.name).toBe('Timer');
	});
});

describe('TimerStore persistence', () => {
	it('restores future, expired, and paused timers', () => {
		const harness = createHarness();
		const now = 2_000_000;
		harness.setNow(now);

		harness.store.load([
			{
				id: 'future',
				name: 'Future',
				durationMs: 60_000,
				remainingMs: 0,
				status: 'running',
				endAt: now + 30_000,
			},
			{
				id: 'expired',
				name: 'Expired',
				durationMs: 60_000,
				remainingMs: 60_000,
				status: 'running',
				endAt: now - 1,
			},
			{
				id: 'paused',
				name: 'Paused',
				durationMs: 60_000,
				remainingMs: 15_000,
				status: 'paused',
				endAt: null,
			},
			{
				id: 'legacy',
				name: '',
				durationMs: 5000,
				remainingMs: 99_999,
				status: 'mystery',
				endAt: null,
			},
			{ id: 'invalid', durationMs: 0, status: 'idle' },
			{
				id: 'future',
				name: 'Duplicate',
				durationMs: 10_000,
				remainingMs: 10_000,
				status: 'idle',
				endAt: null,
			},
		]);

		expect(harness.store.getTimers().map((timer) => timer.id)).toEqual([
			'future',
			'expired',
			'paused',
			'legacy',
		]);
		expect(harness.store.getTimer('future')).toMatchObject({
			status: 'running',
			remainingMs: 30_000,
			endAt: now + 30_000,
		});
		expect(harness.store.getTimer('expired')).toMatchObject({
			status: 'finished',
			remainingMs: 0,
		});
		expect(harness.store.getTimer('paused')).toMatchObject({
			status: 'paused',
			remainingMs: 15_000,
		});
		expect(harness.store.getTimer('legacy')).toMatchObject({
			name: 'Timer',
			status: 'idle',
			remainingMs: 5000,
		});
		expect(harness.finished).toHaveLength(0);
	});

	it('treats a running record without end time as paused', () => {
		const harness = createHarness();
		harness.store.load([
			{
				id: 'broken',
				name: 'Broken',
				durationMs: 10_000,
				remainingMs: 4_000,
				status: 'running',
				endAt: null,
			},
		]);

		expect(harness.store.getTimer('broken')).toMatchObject({
			status: 'paused',
			remainingMs: 4_000,
		});
	});

	it('snapshots running timers with the remaining wall time', () => {
		const harness = createHarness();
		const timer = harness.store.add('Snapshot', 10_000);
		if (!timer) throw new Error('Timer was not created');
		harness.store.start(timer.id);

		harness.advance(3_000);
		const snapshot = harness.store.snapshot()[0];
		expect(snapshot).toMatchObject({
			status: 'running',
			remainingMs: 7_000,
			endAt: 1_010_000,
		});

		harness.advance(10_000);
		const expired = harness.store.snapshot()[0];
		expect(expired).toMatchObject({
			status: 'finished',
			remainingMs: 0,
			endAt: null,
		});
	});

	it('round-trips through load and snapshot', () => {
		const source = createHarness();
		const timer = source.store.add('Round trip', 10_000);
		if (!timer) throw new Error('Timer was not created');
		source.store.start(timer.id);
		source.advance(4_000);

		const restored = createHarness();
		restored.setNow(1_004_000);
		restored.store.load(source.store.snapshot());

		expect(restored.store.getTimer(timer.id)).toMatchObject({
			name: 'Round trip',
			status: 'running',
			remainingMs: 6_000,
			endAt: 1_010_000,
		});
	});
});

describe('progressFor', () => {
	it('reports zero, partial, and complete progress', () => {
		const timer: Timer = {
			id: 'progress',
			name: 'Progress',
			durationMs: 10_000,
			remainingMs: 10_000,
			status: 'idle',
			endAt: null,
		};

		expect(progressFor(timer, 0)).toBe(0);
		expect(progressFor({ ...timer, status: 'running', endAt: 15_000 }, 10_000)).toBe(0.5);
		expect(progressFor({ ...timer, status: 'finished', remainingMs: 0 }, 0)).toBe(1);
	});
});
