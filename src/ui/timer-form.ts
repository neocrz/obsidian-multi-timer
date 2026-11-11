import { Notice } from 'obsidian';
import { normalizeDurationInput, type NormalizedTime } from '../core/duration';

export interface TimerFormCallbacks {
	onSubmit(durationMs: number): void;
}

export interface TimerFormRefs {
	form: HTMLFormElement;
	hoursInput: HTMLInputElement;
	minutesInput: HTMLInputElement;
	secondsInput: HTMLInputElement;
	normalize(): NormalizedTime;
}

function createField(parent: HTMLElement, label: string, max: number): HTMLInputElement {
	const field = parent.createEl('label', { cls: 'mt-field' });
	field.createSpan({ text: label });
	const input = field.createEl('input');
	input.type = 'number';
	input.inputMode = 'numeric';
	input.min = '0';
	input.max = String(max);
	input.step = '1';
	input.value = '0';
	input.setAttribute('aria-label', `${label} for the new timer`);
	return input;
}

export function createTimerForm(
	container: HTMLElement,
	callbacks: TimerFormCallbacks,
): TimerFormRefs {
	const form = container.createEl('form', { cls: 'mt-form' });
	// Native max validation would reject 120 seconds before we can carry it into minutes.
	form.noValidate = true;

	const fields = form.createDiv({ cls: 'mt-fields' });
	const hoursInput = createField(fields, 'Hours', 99);
	const minutesInput = createField(fields, 'Minutes', 59);
	const secondsInput = createField(fields, 'Seconds', 59);

	form.createEl('p', {
		cls: 'mt-form-hint',
		text: 'Minutes and seconds carry over automatically.',
	});

	const addButton = form.createEl('button', {
		cls: 'mt-add-button mod-cta',
		text: '+ Timer',
	});
	addButton.type = 'submit';
	addButton.setAttribute('aria-label', 'Add timer');

	const normalize = (): NormalizedTime => {
		const normalized = normalizeDurationInput(
			hoursInput.value,
			minutesInput.value,
			secondsInput.value,
		);
		hoursInput.value = String(normalized.hours);
		minutesInput.value = String(normalized.minutes);
		secondsInput.value = String(normalized.seconds);
		return normalized;
	};

	for (const input of [hoursInput, minutesInput, secondsInput]) {
		input.addEventListener('blur', normalize);
	}

	form.addEventListener('submit', (event) => {
		event.preventDefault();
		const normalized = normalize();
		if (normalized.totalMs <= 0) {
			new Notice('Set a duration greater than zero.');
			secondsInput.focus();
			return;
		}
		callbacks.onSubmit(normalized.totalMs);
	});

	return { form, hoursInput, minutesInput, secondsInput, normalize };
}
