import type { App } from 'obsidian';
import type { TimerStore } from './core/timer-store';
import type { TimerSettings } from './settings';

/** The subset of the plugin the sidebar view needs. Keeps the view decoupled from main.ts. */
export interface TimerViewHost {
	readonly app: App;
	readonly timerStore: TimerStore;
	readonly settings: TimerSettings;
	unlockAudio(): void;
	openSettings(): void;
}

/** The subset of the plugin the settings tab needs. */
export interface TimerSettingsHost {
	readonly app: App;
	readonly settings: TimerSettings;
	saveSettings(): Promise<void>;
	resetSettings(): Promise<void>;
	playTestSound(): void;
}
