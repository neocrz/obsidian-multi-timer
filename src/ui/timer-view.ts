import { ItemView, Notice, WorkspaceLeaf, setIcon } from 'obsidian';
import { DEFAULT_TIMER_NAME, RIBBON_ICON, VIEW_TYPE } from '../constants';
import type { DropPosition } from '../core/reorder';
import type { TimerViewHost } from '../host';
import type { Timer } from '../types';
import { createTimerCard, updateTimerCard, type TimerCardRefs } from './timer-card';
import { createTimerForm } from './timer-form';

interface DropTarget {
	id: string;
	position: DropPosition;
	card: HTMLElement;
}

function eventElement(event: DragEvent): HTMLElement | null {
	const node = event.target as Node | null;
	return node?.instanceOf(HTMLElement) ? node : null;
}

export class TimerView extends ItemView {
	private readonly cards = new Map<string, TimerCardRefs>();
	private listEl!: HTMLElement;
	private emptyEl!: HTMLElement;
	private summaryEl!: HTMLElement;
	private dragId: string | null = null;
	private dropTarget: DropTarget | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly host: TimerViewHost,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Timers';
	}

	getIcon(): string {
		return RIBBON_ICON;
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass('mt-view');
		this.build();
		this.register(this.host.timerStore.onChange(() => this.syncTimers()));
		this.register(this.host.timerStore.onTick(() => this.updateClocks()));
		this.registerDomEvent(this.contentEl, 'pointerdown', () => this.host.unlockAudio());
		this.syncTimers();
	}

	async onClose(): Promise<void> {
		this.cards.clear();
		this.contentEl.empty();
	}

	private build(): void {
		const { contentEl } = this;
		contentEl.empty();

		const header = contentEl.createDiv({ cls: 'mt-header' });
		const titleGroup = header.createDiv({ cls: 'mt-header-title' });
		titleGroup.createEl('h2', { text: 'Timers' });
		this.summaryEl = titleGroup.createEl('p', { cls: 'mt-muted', text: 'No timers' });

		const actions = header.createDiv({ cls: 'mt-header-actions' });
		const settingsButton = actions.createEl('button', { cls: 'mt-icon-button' });
		settingsButton.type = 'button';
		setIcon(settingsButton, 'settings');
		settingsButton.setAttribute('aria-label', 'Open timer settings');
		settingsButton.addEventListener('click', () => this.host.openSettings());

		createTimerForm(contentEl, {
			onSubmit: (durationMs) => this.addTimer(durationMs),
		});

		this.listEl = contentEl.createDiv({ cls: 'mt-list' });
		this.registerDomEvent(this.listEl, 'dragstart', (event) => this.onDragStart(event));
		this.registerDomEvent(this.listEl, 'dragover', (event) => this.onDragOver(event));
		this.registerDomEvent(this.listEl, 'drop', (event) => this.onDrop(event));
		this.registerDomEvent(this.listEl, 'dragend', () => this.clearDragState());

		this.emptyEl = contentEl.createDiv({ cls: 'mt-empty' });
		const emptyIcon = this.emptyEl.createDiv({ cls: 'mt-empty-icon' });
		setIcon(emptyIcon, 'timer');
		this.emptyEl.createEl('p', { text: 'No timers yet.' });
		this.emptyEl.createEl('p', {
			cls: 'mt-muted',
			text: 'Set a duration above, then select + Timer.',
		});
	}

	private addTimer(durationMs: number): void {
		this.host.unlockAudio();
		const timer = this.host.timerStore.add(DEFAULT_TIMER_NAME, durationMs);
		if (!timer) new Notice('Set a duration greater than zero.');
	}

	private syncTimers(): void {
		const timers = this.host.timerStore.getTimers();
		const currentIds = [...this.cards.keys()];
		const nextIds = timers.map((timer) => timer.id);
		const structural =
			currentIds.length !== nextIds.length ||
			currentIds.some((id, index) => id !== nextIds[index]);

		if (structural) {
			this.rebuildList(timers);
		} else {
			this.updateCards(timers);
		}

		this.updateSummary(timers);
		this.emptyEl.classList.toggle('is-hidden', timers.length > 0);
		this.listEl.classList.toggle('is-hidden', timers.length === 0);
	}

	private rebuildList(timers: readonly Timer[]): void {
		this.clearDragState();
		this.cards.clear();
		this.listEl.empty();
		const now = Date.now();

		for (const timer of timers) {
			const refs = createTimerCard(this.listEl, timer, {
				onToggle: (id) => this.toggle(id),
				onReset: (id) => this.host.timerStore.reset(id),
				onDelete: (id) => this.host.timerStore.remove(id),
				onRename: (id, name) => this.host.timerStore.rename(id, name),
			});
			updateTimerCard(refs, timer, now);
			this.cards.set(timer.id, refs);
		}
	}

	private updateCards(timers: readonly Timer[]): void {
		const now = Date.now();
		const activeElement = this.contentEl.ownerDocument.activeElement;

		for (const timer of timers) {
			const refs = this.cards.get(timer.id);
			if (!refs) continue;

			updateTimerCard(refs, timer, now);
			if (refs.nameEl !== activeElement && refs.nameEl.textContent !== timer.name) {
				refs.nameEl.textContent = timer.name;
			}
		}
	}

	private updateClocks(): void {
		const now = Date.now();
		for (const timer of this.host.timerStore.getTimers()) {
			const refs = this.cards.get(timer.id);
			if (refs) updateTimerCard(refs, timer, now);
		}
	}

	private updateSummary(timers: readonly Timer[]): void {
		const count = timers.length;
		const running = timers.filter((timer) => timer.status === 'running').length;
		const base = `${count} timer${count === 1 ? '' : 's'}`;
		this.summaryEl.textContent = running > 0 ? `${base} · ${running} running` : base;
	}

	private toggle(id: string): void {
		this.host.unlockAudio();
		const timer = this.host.timerStore.getTimer(id);
		if (!timer) return;

		if (timer.status === 'running') {
			this.host.timerStore.pause(id);
		} else {
			this.host.timerStore.start(id);
		}
	}

	private onDragStart(event: DragEvent): void {
		const target = eventElement(event);
		if (!target) return;

		const card = target.closest<HTMLElement>('.mt-card');
		if (!card) return;

		if (target.closest('button, input, [contenteditable="true"]')) {
			event.preventDefault();
			return;
		}

		const id = card.dataset.timerId;
		if (!id) return;

		this.dragId = id;
		card.classList.add('is-dragging');
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', id);
		}
	}

	private onDragOver(event: DragEvent): void {
		if (!this.dragId) return;

		const target = this.findDropTarget(event, this.dragId);
		if (!target) {
			this.clearDropIndicator();
			this.dropTarget = null;
			return;
		}

		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

		if (this.dropTarget?.id === target.id && this.dropTarget.position === target.position) {
			return;
		}

		this.clearDropIndicator();
		target.card.classList.add(
			target.position === 'before' ? 'mt-drop-before' : 'mt-drop-after',
		);
		this.dropTarget = target;
	}

	private onDrop(event: DragEvent): void {
		const draggedId = this.dragId;
		const target = draggedId ? this.findDropTarget(event, draggedId) : null;

		event.preventDefault();
		this.clearDragState();

		if (!draggedId || !target) return;
		this.host.timerStore.reorder(draggedId, target.id, target.position);
	}

	private findDropTarget(event: DragEvent, draggedId: string): DropTarget | null {
		const cards = Array.from(this.listEl.querySelectorAll<HTMLElement>('.mt-card')).filter(
			(card) => card.dataset.timerId !== draggedId,
		);
		if (cards.length === 0) return null;

		const eventTarget = eventElement(event)?.closest<HTMLElement>('.mt-card') ?? null;
		let card = eventTarget && eventTarget.dataset.timerId !== draggedId ? eventTarget : null;

		if (!card) {
			let closest: { card: HTMLElement; distance: number } | null = null;
			for (const candidate of cards) {
				const rect = candidate.getBoundingClientRect();
				const distance = Math.abs(event.clientY - (rect.top + rect.height / 2));
				if (!closest || distance < closest.distance) {
					closest = { card: candidate, distance };
				}
			}
			card = closest?.card ?? null;
		}

		if (!card) return null;

		const id = card.dataset.timerId;
		if (!id) return null;

		const rect = card.getBoundingClientRect();
		const position: DropPosition =
			event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';

		return { id, position, card };
	}

	private clearDropIndicator(): void {
		for (const card of this.listEl.querySelectorAll<HTMLElement>('.mt-card')) {
			card.classList.remove('mt-drop-before', 'mt-drop-after');
		}
	}

	private clearDragState(): void {
		this.dragId = null;
		this.dropTarget = null;
		for (const card of this.listEl.querySelectorAll<HTMLElement>('.mt-card')) {
			card.classList.remove('is-dragging', 'mt-drop-before', 'mt-drop-after');
		}
	}
}
