import { setIcon } from 'obsidian';
import { formatDuration } from '../core/duration';
import { normalizeTimerName, progressFor, remainingMsFor } from '../core/timer-store';
import type { Timer, TimerStatus } from '../types';

export interface TimerCardCallbacks {
	onToggle(id: string): void;
	onReset(id: string): void;
	onDelete(id: string): void;
	onRename(id: string, name: string): void;
}

export interface TimerCardRefs {
	root: HTMLElement;
	nameEl: HTMLElement;
	displayEl: HTMLElement;
	statusEl: HTMLElement;
	progressEl: HTMLElement;
	progressFillEl: HTMLElement;
	startButton: HTMLButtonElement;
}

const STATUS_LABELS: Record<TimerStatus, string> = {
	idle: 'Idle',
	running: 'Running',
	paused: 'Paused',
	finished: 'Finished',
};

const ACTION_LABELS: Record<TimerStatus, string> = {
	idle: 'Start',
	running: 'Pause',
	paused: 'Resume',
	finished: 'Restart',
};

export function createTimerCard(
	container: HTMLElement,
	timer: Timer,
	callbacks: TimerCardCallbacks,
): TimerCardRefs {
	const root = container.createDiv({ cls: 'mt-card' });
	root.dataset.timerId = timer.id;
	root.draggable = true;

	const header = root.createDiv({ cls: 'mt-card-header' });

	const handle = header.createDiv({ cls: 'mt-drag-handle' });
	setIcon(handle, 'grip-vertical');
	handle.setAttribute('aria-hidden', 'true');
	handle.setAttribute('title', 'Drag to reorder');

	const nameEl = header.createDiv({ cls: 'mt-name', text: timer.name });
	nameEl.contentEditable = 'true';
	nameEl.spellcheck = false;
	nameEl.tabIndex = 0;
	nameEl.setAttribute('role', 'textbox');
	nameEl.setAttribute('aria-label', 'Timer name. Click to edit.');
	nameEl.setAttribute('title', 'Click to rename');

	const statusEl = header.createDiv({ cls: 'mt-status' });

	const displayEl = root.createDiv({ cls: 'mt-display' });
	displayEl.setAttribute('aria-live', 'off');

	const progressEl = root.createDiv({ cls: 'mt-progress' });
	progressEl.setAttribute('role', 'progressbar');
	progressEl.setAttribute('aria-label', 'Timer progress');
	progressEl.setAttribute('aria-valuemin', '0');
	progressEl.setAttribute('aria-valuemax', '100');
	const progressFillEl = progressEl.createDiv({ cls: 'mt-progress-fill' });

	const controls = root.createDiv({ cls: 'mt-controls' });
	const startButton = controls.createEl('button', { cls: 'mt-start mod-cta', text: 'Start' });
	startButton.type = 'button';
	const resetButton = controls.createEl('button', { cls: 'mt-reset', text: 'Reset' });
	resetButton.type = 'button';
	const deleteButton = controls.createEl('button', { cls: 'mt-delete', text: 'Delete' });
	deleteButton.type = 'button';
	deleteButton.setAttribute('aria-label', `Delete ${timer.name}`);

	let nameBeforeEdit = timer.name;

	const commitName = (): void => {
		const nextName = normalizeTimerName(nameEl.textContent);
		nameEl.textContent = nextName;
		if (nextName === nameBeforeEdit) return;

		nameBeforeEdit = nextName;
		callbacks.onRename(timer.id, nextName);
	};

	nameEl.addEventListener('focus', () => {
		nameBeforeEdit = normalizeTimerName(nameEl.textContent);
	});
	nameEl.addEventListener('blur', commitName);
	nameEl.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			nameEl.blur();
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			nameEl.textContent = nameBeforeEdit;
			nameEl.blur();
		}
	});

	startButton.addEventListener('click', () => callbacks.onToggle(timer.id));
	resetButton.addEventListener('click', () => callbacks.onReset(timer.id));
	deleteButton.addEventListener('click', () => callbacks.onDelete(timer.id));

	const refs: TimerCardRefs = {
		root,
		nameEl,
		displayEl,
		statusEl,
		progressEl,
		progressFillEl,
		startButton,
	};

	updateTimerCard(refs, timer, Date.now());
	return refs;
}

export function updateTimerCard(refs: TimerCardRefs, timer: Timer, now: number): void {
	const remainingMs = remainingMsFor(timer, now);
	const action = ACTION_LABELS[timer.status];

	refs.displayEl.textContent = formatDuration(remainingMs);
	refs.statusEl.textContent = STATUS_LABELS[timer.status];
	refs.startButton.textContent = action;
	refs.startButton.setAttribute('aria-label', `${action} ${timer.name}`);

	refs.root.dataset.status = timer.status;
	refs.root.classList.toggle('is-running', timer.status === 'running');
	refs.root.classList.toggle('is-paused', timer.status === 'paused');
	refs.root.classList.toggle('is-finished', timer.status === 'finished');

	const percent = Math.round(progressFor(timer, now) * 100);
	refs.progressFillEl.style.width = `${percent}%`;
	refs.progressEl.setAttribute('aria-valuenow', String(percent));
}
