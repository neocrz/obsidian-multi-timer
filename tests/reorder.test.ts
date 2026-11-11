import { describe, expect, it } from 'vitest';
import { reorderItems, sameOrder } from '../src/core/reorder';

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('reorderItems', () => {
	it('moves an item before a target', () => {
		expect(reorderItems(items, 'a', 'c', 'before').map((item) => item.id)).toEqual([
			'b',
			'a',
			'c',
		]);
	});

	it('moves an item after a target', () => {
		expect(reorderItems(items, 'c', 'a', 'after').map((item) => item.id)).toEqual([
			'a',
			'c',
			'b',
		]);
	});

	it('moves upward and downward', () => {
		expect(reorderItems(items, 'c', 'a', 'before').map((item) => item.id)).toEqual([
			'c',
			'a',
			'b',
		]);
		expect(reorderItems(items, 'a', 'b', 'after').map((item) => item.id)).toEqual([
			'b',
			'a',
			'c',
		]);
	});

	it('returns a copy for invalid or no-op moves', () => {
		const copy = reorderItems(items, 'a', 'a', 'before');
		expect(copy).toEqual(items);
		expect(copy).not.toBe(items);
		expect(reorderItems(items, 'missing', 'a', 'before')).toEqual(items);
		expect(reorderItems(items, 'a', 'missing', 'before')).toEqual(items);
	});

	it('does not mutate its input', () => {
		const source = [...items];
		reorderItems(source, 'a', 'c', 'after');
		expect(source).toEqual(items);
	});
});

describe('sameOrder', () => {
	it('compares ids in order', () => {
		expect(sameOrder(items, [{ id: 'a' }, { id: 'b' }, { id: 'c' }])).toBe(true);
		expect(sameOrder(items, [{ id: 'b' }, { id: 'a' }, { id: 'c' }])).toBe(false);
		expect(sameOrder(items, [{ id: 'a' }])).toBe(false);
	});
});
