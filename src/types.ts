export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

/** A single timer. Running timers are defined by `endAt`, not by a decrementing counter. */
export interface Timer {
	id: string;
	name: string;
	durationMs: number;
	/** Snapshot of the remaining time. Authoritative only while not running. */
	remainingMs: number;
	status: TimerStatus;
	/** Epoch milliseconds at which a running timer ends; null when not running. */
	endAt: number | null;
}

/** Persisted timers use the same shape as live timers. */
export type TimerSnapshot = Timer;
