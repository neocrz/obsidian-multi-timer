import { App, Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { ChimePlayer } from './audio/chime';
import {
	COMMAND_IDS,
	PLUGIN_ID,
	RIBBON_ICON,
	SAVE_DEBOUNCE_MS,
	TICK_INTERVAL_MS,
	VIEW_TYPE,
} from './constants';
import { TimerStore } from './core/timer-store';
import type { TimerSettingsHost, TimerViewHost } from './host';
import { DEFAULT_SETTINGS, normalizeSettings, type TimerSettings } from './settings';
import { loadPluginData, serializePluginData } from './storage';
import type { Timer } from './types';
import { TimerSettingTab } from './ui/settings-tab';
import { TimerView } from './ui/timer-view';

interface AppWithSettings extends App {
	setting?: {
		open(): void;
		openTabById(id: string): void;
	};
}

export default class MultiTimerPlugin extends Plugin implements TimerViewHost, TimerSettingsHost {
	declare settings: TimerSettings;
	declare timerStore: TimerStore;
	private chime!: ChimePlayer;
	private saveHandle: number | null = null;

	async onload(): Promise<void> {
		const data = loadPluginData(await this.loadData());
		this.settings = normalizeSettings(data.settings);
		this.timerStore = new TimerStore();
		this.timerStore.load(data.timers);
		this.chime = new ChimePlayer(() => this.settings.soundVolume);

		this.registerView(VIEW_TYPE, (leaf) => new TimerView(leaf, this));

		this.addRibbonIcon(RIBBON_ICON, 'Open timers', () => {
			void this.openView();
		});

		this.addCommand({
			id: COMMAND_IDS.open,
			name: 'Open timers',
			callback: () => {
				void this.openView();
			},
		});

		this.addSettingTab(new TimerSettingTab(this.app, this, this));
		this.registerStoreListeners();

		this.registerInterval(
			window.setInterval(() => {
				this.timerStore.tick();
			}, TICK_INTERVAL_MS),
		);
	}

	onunload(): void {
		if (this.saveHandle !== null) {
			window.clearTimeout(this.saveHandle);
			this.saveHandle = null;
		}
		void this.persist();
		this.chime.destroy();
	}

	async openView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
		const leaf: WorkspaceLeaf | null = existing ?? this.app.workspace.getRightLeaf(false);
		if (!leaf) {
			new Notice('Could not open the timer panel.');
			return;
		}

		if (!existing) {
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
		}

		await this.app.workspace.revealLeaf(leaf);
	}

	openSettings(): void {
		const app = this.app as AppWithSettings;
		app.setting?.openTabById(PLUGIN_ID);
		app.setting?.open();
	}

	unlockAudio(): void {
		this.chime.unlock();
	}

	playTestSound(): void {
		this.chime.unlock();
		this.chime.play(true);
	}

	async saveSettings(): Promise<void> {
		await this.persist();
	}

	async resetSettings(): Promise<void> {
		this.settings = { ...DEFAULT_SETTINGS };
		await this.persist();
		new Notice('Timer settings reset.');
	}

	private registerStoreListeners(): void {
		this.register(this.timerStore.onChange(() => this.scheduleSave()));
		this.register(
			this.timerStore.onFinish((timer) => {
				this.handleFinish(timer);
			}),
		);
	}

	private handleFinish(timer: Timer): void {
		if (this.settings.notifyOnFinish) new Notice(`${timer.name} finished.`);
		this.chime.play(this.settings.soundEnabled);
		this.scheduleSave();
	}

	private scheduleSave(): void {
		if (this.saveHandle !== null) window.clearTimeout(this.saveHandle);
		this.saveHandle = window.setTimeout(() => {
			this.saveHandle = null;
			void this.persist();
		}, SAVE_DEBOUNCE_MS);
	}

	private async persist(): Promise<void> {
		try {
			await this.saveData(serializePluginData(this.timerStore.snapshot(), this.settings));
		} catch (error) {
			console.error('[multi-timer] Could not save timer state', error);
		}
	}
}
