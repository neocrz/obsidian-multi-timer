import { DEFAULT_TIMER_NAME, MAX_NAME_LENGTH } from '../constants';
import type { Timer, TimerStatus } from '../types';
import { clampDurationMs } from './duration';
import { reorderItems, sameOrder, type DropPosition } from './reorder';

export interface TimerStoreOptions {
	now?: () => number;
	createId?: () => string;
}

let fallbackIdCounter = 0;

function defaultCreateId(): string {
	const cryptoApi = typeof crypto === 'undefined' ? null : crypto;
	if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();

	fallbackIdCounter += 1;
	return `timer-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}

export function normalizeTimerName(value: unknown): string {
	const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
	return text ? text.slice(0, MAX_NAME_LENGTH) : DEFAULT_TIMER_NAME;
}

export function remainingMsFor(
	timer: Pick<Timer, 'status' | 'remainingMs' | 'endAt'>,
	now: number,
): number {
	if (
		timer.status === 'running' &&
		typeof timer.endAt === 'number' &&
		Number.isFinite(timer.endAt)
	) {
		return Math.max(0, timer.endAt - now);
	}
	return Math.max(0, timer.remainingMs);
}

export function progressFor(timer: Timer, now: number): number {
	if (timer.durationMs <= 0) return 0;
	const remaining = Math.min(timer.durationMs, remainingMsFor(timer, now));
	return Math.min(1, Math.max(0, (timer.durationMs - remaining) / timer.durationMs));
}

function readStatus(value: unknown): TimerStatus | null {
	switch (value) {
		case 'idle':
		case 'running':
		case 'paused':
		case 'finished':
			return value;
		default:
			return null;
	}
}

function clampRemaining(value: unknown, durationMs: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return durationMs;
	return Math.min(durationMs, Math.max(0, Math.floor(value)));
}

/** Normalize one persisted record. Returns null for records that cannot become a timer. */
export function normalizeStoredTimer(raw: unknown, now: number): Timer | null {
	if (!raw || typeof raw !== 'object') return null;

	const record = raw as Partial<Timer>;
	const id = typeof record.id === 'string' ? record.id.trim() : '';
	if (!id) return null;

	const durationMs = clampDurationMs(record.durationMs);
	if (durationMs <= 0) return null;

	const name = normalizeTimerName(record.name);
	const status = readStatus(record.status) ?? 'idle';
	const storedRemaining = clampRemaining(record.remainingMs, durationMs);
	const endAt =
		typeof record.endAt === 'number' && Number.isFinite(record.endAt) ? record.endAt : null;

	if (status === 'running') {
		if (endAt === null) {
			const remainingMs = storedRemaining > 0 ? storedRemaining : durationMs;
			return { id, name, durationMs, remainingMs, status: 'paused', endAt: null };
		}

		const remainingMs = Math.max(0, Math.min(durationMs, endAt - now));
		if (remainingMs <= 0) {
			return { id, name, durationMs, remainingMs: 0, status: 'finished', endAt: null };
		}

		return { id, name, durationMs, remainingMs, status: 'running', endAt: now + remainingMs };
	}

	if (status === 'paused') {
		if (storedRemaining <= 0) {
			return { id, name, durationMs, remainingMs: 0, status: 'finished', endAt: null };
		}
		return {
			id,
			name,
			durationMs,
			remainingMs: storedRemaining,
			status: 'paused',
			endAt: null,
		};
	}

	if (status === 'finished') {
		return { id, name, durationMs, remainingMs: 0, status: 'finished', endAt: null };
	}

	return { id, name, durationMs, remainingMs: durationMs, status: 'idle', endAt: null };
}

/**
 * Owns all timer state and timing arithmetic. It has no Obsidian or DOM dependencies:
 * the plugin drives ticks and persists snapshots, which keeps the domain unit-testable.
 */
export class TimerStore {
	private timers: Timer[] = [];
	private readonly now: () => number;
	private readonly createId: () => string;
	private readonly changeListeners = new Set<() => void>();
	private readonly tickListeners = new Set<() => void>();
	private readonly finishListeners = new Set<(timer: Timer) => void>();

	constructor(options: TimerStoreOptions = {}) {
		this.now = options.now ?? (() => Date.now());
		this.createId = options.createId ?? defaultCreateId;
	}

	onChange(listener: () => void): () => void {
		this.changeListeners.add(listener);
		return () => this.changeListeners.delete(listener);
	}

	onTick(listener: () => void): () => void {
		this.tickListeners.add(listener);
		return () => this.tickListeners.delete(listener);
	}

	onFinish(listener: (timer: Timer) => void): () => void {
		this.finishListeners.add(listener);
		return () => this.finishListeners.delete(listener);
	}

	getTimers(): Timer[] {
		return this.timers.map((timer) => ({ ...timer }));
	}

	getTimer(id: string): Timer | undefined {
		const timer = this.find(id);
		return timer ? { ...timer } : undefined;
	}

	/** Replace persisted state. Expired running timers become finished without firing events. */
	load(records: readonly unknown[]): void {
		const now = this.now();
		const seen = new Set<string>();
		const loaded: Timer[] = [];

		for (const raw of records) {
			const timer = normalizeStoredTimer(raw, now);
			if (!timer || seen.has(timer.id)) continue;
			seen.add(timer.id);
			loaded.push(timer);
		}

		this.timers = loaded;
	}

	add(name: string, durationMs: number): Timer | null {
		const duration = clampDurationMs(durationMs);
		if (duration <= 0) return null;

		const timer: Timer = {
			id: this.nextId(),
			name: normalizeTimerName(name),
			durationMs: duration,
			remainingMs: duration,
			status: 'idle',
			endAt: null,
		};

		this.timers.push(timer);
		this.emitChange();
		return { ...timer };
	}

	start(id: string): boolean {
		const timer = this.find(id);
		if (!timer || timer.status === 'running') return false;

		if (timer.status === 'finished' || timer.remainingMs <= 0) {
			timer.remainingMs = timer.durationMs;
		}

		timer.endAt = this.now() + timer.remainingMs;
		timer.status = 'running';
		this.emitChange();
		return true;
	}

	pause(id: string): boolean {
		const timer = this.find(id);
		if (!timer || timer.status !== 'running') return false;

		const remainingMs = remainingMsFor(timer, this.now());
		timer.endAt = null;

		if (remainingMs <= 0) {
			timer.remainingMs = 0;
			timer.status = 'finished';
			this.emitChange();
			this.emitFinish({ ...timer });
			return true;
		}

		timer.remainingMs = remainingMs;
		timer.status = 'paused';
		this.emitChange();
		return true;
	}

	reset(id: string): boolean {
		const timer = this.find(id);
		if (!timer) return false;

		timer.status = 'idle';
		timer.remainingMs = timer.durationMs;
		timer.endAt = null;
		this.emitChange();
		return true;
	}

	remove(id: string): boolean {
		const index = this.timers.findIndex((timer) => timer.id === id);
		if (index < 0) return false;

		this.timers.splice(index, 1);
		this.emitChange();
		return true;
	}

	rename(id: string, name: string): boolean {
		const timer = this.find(id);
		if (!timer) return false;

		const nextName = normalizeTimerName(name);
		if (nextName === timer.name) return false;

		timer.name = nextName;
		this.emitChange();
		return true;
	}

	reorder(draggedId: string, targetId: string, position: DropPosition): boolean {
		const next = reorderItems(this.timers, draggedId, targetId, position);
		if (sameOrder(this.timers, next)) return false;

		this.timers = next;
		this.emitChange();
		return true;
	}

	/** Advance the clock and collect timers that crossed zero during this tick. */
	tick(): Timer[] {
		const now = this.now();
		const finished: Timer[] = [];

		for (const timer of this.timers) {
			if (timer.status !== 'running') continue;
			if (remainingMsFor(timer, now) > 0) continue;

			timer.status = 'finished';
			timer.remainingMs = 0;
			timer.endAt = null;
			finished.push({ ...timer });
		}

		this.emitTick();

		if (finished.length > 0) {
			this.emitChange();
			for (const timer of finished) this.emitFinish(timer);
		}

		return finished;
	}

	/** Serializable state. Running timers keep their `endAt` so wall time survives a restart. */
	snapshot(): Timer[] {
		const now = this.now();

		return this.timers.map((timer) => {
			if (timer.status !== 'running') return { ...timer };

			const remainingMs = remainingMsFor(timer, now);
			if (remainingMs <= 0) {
				return {
					...timer,
					remainingMs: 0,
					status: 'finished',
					endAt: null,
				};
			}

			return { ...timer, remainingMs };
		});
	}

	private find(id: string): Timer | undefined {
		return this.timers.find((timer) => timer.id === id);
	}

	private nextId(): string {
		for (let attempt = 0; attempt < 10; attempt += 1) {
			const id = this.createId();
			if (id && !this.timers.some((timer) => timer.id === id)) return id;
		}

		let index = this.timers.length + 1;
		let candidate = `timer-${index}`;
		while (this.timers.some((timer) => timer.id === candidate)) {
			index += 1;
			candidate = `timer-${index}`;
		}
		return candidate;
	}

	private emitChange(): void {
		for (const listener of this.changeListeners) listener();
	}

	private emitTick(): void {
		for (const listener of this.tickListeners) listener();
	}

	private emitFinish(timer: Timer): void {
		for (const listener of this.finishListeners) listener(timer);
	}
}
