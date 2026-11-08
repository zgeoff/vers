import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createChainRow } from '../test-utils/create-chain-row';
import { readChainAnchors } from './read-chain-anchors';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test("it reads a chain's appended and verified anchors", async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db, {
    appendedChainIndex: 9,
    appendedNextSeed: 'c0ffee00c0ffee00c0ffee00c0ffee00',
    scopeId: '3_4',
    scopeType: 'world_map_node',
    verifiedChainIndex: 5,
    verifiedNextSeed: 'beef0000beef0000beef0000beef0000',
  });

  const anchors = await readChainAnchors(ctx.db, {
    avatarID: chain.avatarId,
    scopeID: '3_4',
    scopeType: 'world_map_node',
  });

  expect(anchors).toStrictEqual({
    appendedChainIndex: 9,
    appendedNextSeed: 'c0ffee00c0ffee00c0ffee00c0ffee00',
    verifiedChainIndex: 5,
    verifiedNextSeed: 'beef0000beef0000beef0000beef0000',
  });
});

test('it returns null for a chain the avatar never revealed', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db, { scopeId: '3_4', scopeType: 'world_map_node' });

  const anchors = await readChainAnchors(ctx.db, {
    avatarID: chain.avatarId,
    scopeID: '7_7',
    scopeType: 'world_map_node',
  });

  expect(anchors).toBeNull();
});
