import { expect, test } from 'bun:test';
import { createMockSimVersionRow } from './create-mock-sim-version-row';

test('it defaults status to active', () => {
  const row = createMockSimVersionRow();

  expect(row.status).toBe('active');
});

test('it keeps explicit overrides', () => {
  const row = createMockSimVersionRow({ engineHash: 'hash-1', status: 'pruned' });

  expect(row).toMatchObject({ engineHash: 'hash-1', status: 'pruned' });
});
