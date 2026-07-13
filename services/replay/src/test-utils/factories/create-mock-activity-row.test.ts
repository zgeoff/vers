import { expect, test } from 'bun:test';
import { createMockActivityRow } from './create-mock-activity-row';

test('it builds a row with generated identity and matching hash defaults', () => {
  const row = createMockActivityRow();

  expect(row.id).toStartWith('act_');
  expect(row.lastHash).toBe(row.startHash);
  expect(row.seed).toHaveLength(32);
});

test('it keeps explicit overrides', () => {
  const row = createMockActivityRow({ avatarId: 'avatar-1', scopeId: 'node_9' });

  expect(row).toMatchObject({ avatarId: 'avatar-1', scopeId: 'node_9' });
});
