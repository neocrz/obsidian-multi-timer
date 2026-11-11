import { App, Plugin, PluginSettingTab, Setting, type SettingDefinitionItem } from 'obsidian';
import { DEFAULT_SETTINGS } from '../settings';
import type { TimerSettingsHost } from '../host';

const SOUND_DESCRIPTION =
	'The chime is generated with the Web Audio API; no audio files are bundled.';

export class TimerSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		plugin: Plugin,
		private readonly host: TimerSettingsHost,
	) {
		super(app, plugin);
	}

	// --- Declarative settings (Obsidian 1.13+) ---------------------------------

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: 'group',
				heading: 'Sound',
				items: [
					{
						name: 'Play a sound when a timer ends',
						desc: SOUND_DESCRIPTION,
						control: { type: 'toggle', key: 'soundEnabled' },
					},
					{
						name: 'Volume',
						desc: 'Chime volume.',
						control: {
							type: 'slider',
							key: 'soundVolume',
							min: 0,
							max: 100,
							step: 5,
							defaultValue: Math.round(DEFAULT_SETTINGS.soundVolume * 100),
							displayFormat: (value) => `${value}%`,
						},
					},
					{
						name: 'Test sound',
						desc: 'Play the completion chime now.',
						action: () => this.host.playTestSound(),
					},
				],
			},
			{
				type: 'group',
				heading: 'Notifications',
				items: [
					{
						name: 'Show a notice when a timer ends',
						desc: 'Display the timer name in an Obsidian notice when it finishes.',
						control: { type: 'toggle', key: 'notifyOnFinish' },
					},
				],
			},
			{
				type: 'group',
				heading: 'Maintenance',
				items: [
					{
						name: 'Reset settings',
						desc: 'Restore sound and notification defaults. Timers are not changed.',
						action: () => this.reset(),
					},
					{
						name: 'Storage',
						desc: `Timer names, durations, order, and running end times are stored in this plugin's data.json. Default volume: ${Math.round(DEFAULT_SETTINGS.soundVolume * 100)}%.`,
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		switch (key) {
			case 'soundEnabled':
				return this.host.settings.soundEnabled;
			case 'soundVolume':
				return Math.round(this.host.settings.soundVolume * 100);
			case 'notifyOnFinish':
				return this.host.settings.notifyOnFinish;
			default:
				return undefined;
		}
	}

	setControlValue(key: string, value: unknown): void {
		switch (key) {
			case 'soundEnabled':
				this.host.settings.soundEnabled = value === true;
				break;
			case 'soundVolume': {
				const parsed = typeof value === 'number' ? value : Number(value);
				if (!Number.isFinite(parsed)) return;
				this.host.settings.soundVolume = Math.min(100, Math.max(0, parsed)) / 100;
				break;
			}
			case 'notifyOnFinish':
				this.host.settings.notifyOnFinish = value === true;
				break;
			default:
				return;
		}

		void this.host.saveSettings();
	}

	// --- Imperative fallback (Obsidian < 1.13) ---------------------------------

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Sound').setHeading();

		new Setting(containerEl)
			.setName('Play a sound when a timer ends')
			.setDesc(SOUND_DESCRIPTION)
			.addToggle((toggle) =>
				toggle.setValue(this.host.settings.soundEnabled).onChange(async (value) => {
					this.host.settings.soundEnabled = value;
					await this.host.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Volume')
			.setDesc('Chime volume.')
			.addSlider((slider) =>
				slider
					.setLimits(0, 100, 5)
					.setValue(Math.round(this.host.settings.soundVolume * 100))
					.onChange(async (value) => {
						this.host.settings.soundVolume = value / 100;
						await this.host.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Test sound')
			.setDesc('Play the completion chime now.')
			.addButton((button) =>
				button.setButtonText('Play').onClick(() => this.host.playTestSound()),
			);

		new Setting(containerEl).setName('Notifications').setHeading();

		new Setting(containerEl)
			.setName('Show a notice when a timer ends')
			.setDesc('Display the timer name in an Obsidian notice when it finishes.')
			.addToggle((toggle) =>
				toggle.setValue(this.host.settings.notifyOnFinish).onChange(async (value) => {
					this.host.settings.notifyOnFinish = value;
					await this.host.saveSettings();
				}),
			);

		new Setting(containerEl).setName('Maintenance').setHeading();

		new Setting(containerEl)
			.setName('Reset settings')
			.setDesc('Restore sound and notification defaults. Timers are not changed.')
			.addButton((button) => button.setButtonText('Reset').onClick(() => this.reset()));

		new Setting(containerEl)
			.setName('Storage')
			.setDesc(
				`Timer names, durations, order, and running end times are stored in this plugin's data.json. Default volume: ${Math.round(DEFAULT_SETTINGS.soundVolume * 100)}%.`,
			);
	}

	private reset(): void {
		void this.host.resetSettings().then(() => {
			// `update()` is declarative-settings only (Obsidian 1.13+); older
			// versions still render through `display()`.
			if (typeof this.update === 'function') {
				this.update();
			} else {
				this.display();
			}
		});
	}
}
