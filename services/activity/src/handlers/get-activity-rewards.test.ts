import { expect, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import type { ActivityContract } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import {
  createAnonymousViewer,
  createAvatarRow,
  createTestDB,
  createViewer,
} from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';

/**
 * `startActivity` opens its own `db.transaction()` for the chain claim, which can't nest under
 * the default rollback-on-dispose isolation — this suite runs against a real, committed schema
 * clone instead.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);
  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns only the minted rows at or below the verified anchor', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .insertInto('avatarItems')
    .values([
      {
        affixes: [],
        avatarId: avatar.id,
        baseId: 'base_sword',
        chainIndex: started.startChainIndex + 1,
        contentVersion: 'v1',
        keyVersion: 1,
        ordinal: 0,
        rarityId: 'common',
        scopeId: '0_0',
        scopeType: 'world_map_node',
      },
      {
        affixes: [],
        avatarId: avatar.id,
        baseId: 'base_shield',
        chainIndex: started.startChainIndex + 2,
        contentVersion: 'v1',
        keyVersion: 1,
        ordinal: 0,
        rarityId: 'rare',
        scopeId: '0_0',
        scopeType: 'world_map_node',
      },
    ])
    .execute();

  await ctx.db
    .updateTable('activities')
    .set({ verifiedAt: new Date(), verifiedHead: 1 })
    .where('id', '=', started.id)
    .execute();

  const result = await client.getActivityRewards({ activityID: started.id });

  expect(result).toStrictEqual({
    items: [
      {
        chainIndex: started.startChainIndex + 1,
        item: { affixes: [], baseID: 'base_sword', contentVersion: 'v1', rarityID: 'common' },
        ordinal: 0,
      },
    ],
    verifiedHead: 1,
  });
});

test('it orders multiple slots within a chain position by ordinal', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .insertInto('avatarItems')
    .values([
      {
        affixes: [],
        avatarId: avatar.id,
        baseId: 'base_second',
        chainIndex: started.startChainIndex + 1,
        contentVersion: 'v1',
        keyVersion: 1,
        ordinal: 1,
        rarityId: 'common',
        scopeId: '0_0',
        scopeType: 'world_map_node',
      },
      {
        affixes: [],
        avatarId: avatar.id,
        baseId: 'base_first',
        chainIndex: started.startChainIndex + 1,
        contentVersion: 'v1',
        keyVersion: 1,
        ordinal: 0,
        rarityId: 'common',
        scopeId: '0_0',
        scopeType: 'world_map_node',
      },
    ])
    .execute();

  await ctx.db
    .updateTable('activities')
    .set({ verifiedAt: new Date(), verifiedHead: 1 })
    .where('id', '=', started.id)
    .execute();

  const result = await client.getActivityRewards({ activityID: started.id });

  expect(result.items.map((item) => item.item.baseID)).toStrictEqual(['base_first', 'base_second']);
});

test('it returns only rows above the afterChainIndex cursor', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .insertInto('avatarItems')
    .values([
      {
        affixes: [],
        avatarId: avatar.id,
        baseId: 'base_first',
        chainIndex: started.startChainIndex + 1,
        contentVersion: 'v1',
        keyVersion: 1,
        ordinal: 0,
        rarityId: 'common',
        scopeId: '0_0',
        scopeType: 'world_map_node',
      },
      {
        affixes: [],
        avatarId: avatar.id,
        baseId: 'base_second',
        chainIndex: started.startChainIndex + 2,
        contentVersion: 'v1',
        keyVersion: 1,
        ordinal: 0,
        rarityId: 'common',
        scopeId: '0_0',
        scopeType: 'world_map_node',
      },
    ])
    .execute();

  await ctx.db
    .updateTable('activities')
    .set({ verifiedAt: new Date(), verifiedHead: 2 })
    .where('id', '=', started.id)
    .execute();

  const result = await client.getActivityRewards({
    activityID: started.id,
    afterChainIndex: started.startChainIndex + 1,
  });

  expect(result.items.map((item) => item.chainIndex)).toStrictEqual([started.startChainIndex + 2]);
});

test('it returns the identical response on a repeated call', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .insertInto('avatarItems')
    .values({
      affixes: [],
      avatarId: avatar.id,
      baseId: 'base_sword',
      chainIndex: started.startChainIndex + 1,
      contentVersion: 'v1',
      keyVersion: 1,
      ordinal: 0,
      rarityId: 'common',
      scopeId: '0_0',
      scopeType: 'world_map_node',
    })
    .execute();

  await ctx.db
    .updateTable('activities')
    .set({ verifiedAt: new Date(), verifiedHead: 1 })
    .where('id', '=', started.id)
    .execute();

  const first = await client.getActivityRewards({ activityID: started.id });
  const second = await client.getActivityRewards({ activityID: started.id });

  expect(second).toStrictEqual(first);
});

test('it rejects an activity owned by another caller with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const owner = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: owner.user.id });

  const ownerClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: owner.token });

  const started = await ownerClient.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const otherViewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const otherClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: otherViewer.token });

  expect(otherClient.getActivityRewards({ activityID: started.id })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it rejects a missing activity with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.getActivityRewards({ activityID: 'not_an_activity' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.getActivityRewards({ activityID: 'activity_1' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

test('it omits an unverified tail row above the verified anchor', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await ctx.db
    .insertInto('avatarItems')
    .values({
      affixes: [],
      avatarId: avatar.id,
      baseId: 'base_unverified',
      chainIndex: started.startChainIndex + 1,
      contentVersion: 'v1',
      keyVersion: 1,
      ordinal: 0,
      rarityId: 'common',
      scopeId: '0_0',
      scopeType: 'world_map_node',
    })
    .execute();

  const result = await client.getActivityRewards({ activityID: started.id });

  expect(result).toStrictEqual({ items: [], verifiedHead: 0 });
});
