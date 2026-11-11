export type DropPosition = 'before' | 'after';

/**
 * Move one item next to another without mutating the input array.
 * Returns a copy unchanged when either id is missing or both ids are equal.
 */
export function reorderItems<T extends { id: string }>(
	items: readonly T[],
	draggedId: string,
	targetId: string,
	position: DropPosition,
): T[] {
	if (draggedId === targetId) return [...items];

	const draggedIndex = items.findIndex((item) => item.id === draggedId);
	if (draggedIndex < 0) return [...items];

	const dragged = items[draggedIndex];
	if (!dragged) return [...items];

	const remaining = items.filter((item) => item.id !== draggedId);
	const targetIndex = remaining.findIndex((item) => item.id === targetId);
	if (targetIndex < 0) return [...items];

	const insertAt = position === 'before' ? targetIndex : targetIndex + 1;
	const result = [...remaining];
	result.splice(insertAt, 0, dragged);
	return result;
}

export function sameOrder<T extends { id: string }>(
	left: readonly T[],
	right: readonly T[],
): boolean {
	return (
		left.length === right.length && left.every((item, index) => item.id === right[index]?.id)
	);
}
