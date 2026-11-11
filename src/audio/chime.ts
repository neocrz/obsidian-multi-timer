type AudioContextConstructor = typeof AudioContext;

const NOTES = [880, 1108.73, 1318.51];
const NOTE_SPACING_SECONDS = 0.16;
const NOTE_SECONDS = 0.3;
const REPEAT_SPACING_SECONDS = 0.78;

/**
 * Small Web Audio chime. No audio files are shipped and no network is used.
 * Chromium only allows audio after a user gesture, so the view calls `unlock()` on pointerdown.
 */
export class ChimePlayer {
	private context: AudioContext | null = null;
	private readonly getVolume: () => number;

	constructor(getVolume: () => number) {
		this.getVolume = getVolume;
	}

	unlock(): void {
		const context = this.ensureContext();
		if (context && context.state === 'suspended') {
			void context.resume().catch(() => undefined);
		}
	}

	play(enabled: boolean): void {
		if (!enabled) return;

		const volume = Math.min(1, Math.max(0, this.getVolume()));
		if (volume <= 0) return;

		const context = this.ensureContext();
		if (!context || context.state === 'closed') return;
		if (context.state === 'suspended') {
			void context.resume().catch(() => undefined);
		}

		const start = context.currentTime + 0.02;
		for (let repeat = 0; repeat < 2; repeat += 1) {
			const repeatStart = start + repeat * REPEAT_SPACING_SECONDS;
			NOTES.forEach((frequency, index) => {
				this.scheduleNote(
					context,
					frequency,
					repeatStart + index * NOTE_SPACING_SECONDS,
					volume,
				);
			});
		}
	}

	destroy(): void {
		if (!this.context) return;
		const context = this.context;
		this.context = null;
		if (context.state !== 'closed') {
			void context.close().catch(() => undefined);
		}
	}

	private scheduleNote(
		context: AudioContext,
		frequency: number,
		start: number,
		volume: number,
	): void {
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		const peak = Math.max(0.0001, volume * 0.22);

		oscillator.type = 'sine';
		oscillator.frequency.setValueAtTime(frequency, start);
		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + NOTE_SECONDS);

		oscillator.connect(gain);
		gain.connect(context.destination);
		oscillator.start(start);
		oscillator.stop(start + NOTE_SECONDS + 0.02);
	}

	private ensureContext(): AudioContext | null {
		if (this.context && this.context.state !== 'closed') return this.context;

		const windowWithWebkit = window as Window & {
			webkitAudioContext?: AudioContextConstructor;
		};
		const Constructor = window.AudioContext ?? windowWithWebkit.webkitAudioContext;
		if (!Constructor) return null;

		try {
			this.context = new Constructor();
			return this.context;
		} catch {
			return null;
		}
	}
}
