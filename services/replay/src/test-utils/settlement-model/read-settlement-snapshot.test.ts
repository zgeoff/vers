import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../create-activity-row';
import { createChainRow } from '../create-chain-row';
import { readSettlementSnapshot } from './read-settlement-snapshot';

test("it reads the avatar's activities, chains, XP, first clears and item coordinates", async () => {
  await using ctx = await createTestDB();

  const chain = await createChainRow(ctx.db, {
    appendedChainIndex: 6,
    scopeId: '1_0',
    verifiedChainIndex: 3,
  });

  await ctx.db.updateTable('avatars').set({ xp: 18 }).where('id', '=', chain.avatarId).execute();

  await createActivityRow(ctx.db, {
    appendedHead: 6,
    avatarId: chain.avatarId,
    id: 'act_read',
    scopeId: '1_0',
    settledXp: 18,
    status: 'stopped',
    verifiedHead: 3,
    writerSessionId: 'device-a',
  });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: chain.avatarId, key: '1_0', kind: 'first_clear' })
    .execute();

  await ctx.db
    .insertInto('avatarItems')
    .values({
      affixes: [],
      avatarId: chain.avatarId,
      baseId: 'sword',
      chainIndex: 2,
      contentVersion: '2',
      keyVersion: 1,
      ordinal: 0,
      rarityId: 'common',
      scopeId: '1_0',
      scopeType: 'world_map_node',
    })
    .execute();

  expect(readSettlementSnapshot(ctx.db, chain.avatarId)).resolves.toStrictEqual({
    activities: [
      {
        appendedHead: 6,
        id: 'act_read',
        settledXP: 18,
        status: 'stopped',
        verifiedHead: 3,
        writer: 'device-a',
      },
    ],
    avatarXP: 18,
    chains: [{ appendedChainIndex: 6, scopeID: '1_0', verifiedChainIndex: 3 }],
    grants: ['1_0'],
    items: ['1_0:2:0'],
  });
});
