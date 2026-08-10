import { expect, test } from 'bun:test';
import { createMockChainRow } from './create-mock-chain-row';

test('it builds a default chain row whose anchors both start at the genesis seed', () => {
  const row = createMockChainRow();

  expect(row).toStrictEqual({
    appendedNextSeed: row.genesisSeed,
    avatarId: expect.toBeString(),
    genesisSeed: expect.toBeString(),
    scopeId: expect.toBeString(),
    scopeType: 'world_map_node',
    verifiedNextSeed: row.genesisSeed,
  });
});

test('it keeps explicit overrides', () => {
  const row = createMockChainRow({ appendedNextSeed: 'ff00', avatarId: 'avatar-1' });

  expect(row).toMatchObject({ appendedNextSeed: 'ff00', avatarId: 'avatar-1' });
});
