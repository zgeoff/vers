import { expect, test } from 'bun:test';
import { createMockChainRow } from './create-mock-chain-row';

test('it builds a chain whose anchors both start at the genesis seed', () => {
  const row = createMockChainRow();

  expect(row.appendedNextSeed).toBe(row.genesisSeed);
  expect(row.verifiedNextSeed).toBe(row.genesisSeed);
});

test('it keeps explicit overrides', () => {
  const row = createMockChainRow({ appendedNextSeed: 'ff00', avatarId: 'avatar-1' });

  expect(row).toMatchObject({ appendedNextSeed: 'ff00', avatarId: 'avatar-1' });
});
