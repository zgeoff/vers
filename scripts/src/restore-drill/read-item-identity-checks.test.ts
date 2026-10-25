import { expect, test } from 'bun:test';
import {
  createActivityRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { readItemIdentityChecks } from './read-item-identity-checks';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it finds no violation when each item sits at a verified position of one chain history', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 4,
    avatarId: avatar.id,
    id: 'act_first',
    scopeId: '2_3',
    startChainIndex: 0,
    status: 'stopped',
    verifiedHead: 3,
  });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_second',
    scopeId: '2_3',
    startChainIndex: 4,
  });

  await ctx.db
    .insertInto('avatarItems')
    .values({
      affixes: [],
      avatarId: avatar.id,
      baseId: 'rusty-sword',
      chainIndex: 3,
      contentVersion: '1',
      keyVersion: 1,
      ordinal: 0,
      rarityId: 'common',
      scopeId: '2_3',
      scopeType: 'world_map_node',
    })
    .execute();

  const checks = await readItemIdentityChecks(ctx.db);

  expect(checks).toStrictEqual([
    {
      area: 'item-identities',
      name: 'every item sits at a verified chain position',
      violations: [],
    },
    {
      area: 'item-identities',
      name: 'no two live activities claim one chain position',
      violations: [],
    },
    {
      area: 'item-identities',
      name: 'every item’s content version is published',
      violations: [],
    },
  ]);
});

test('it reports an item past the verified head of every activity on its chain', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 4,
    avatarId: avatar.id,
    scopeId: '2_3',
    startChainIndex: 0,
    status: 'stopped',
    verifiedHead: 3,
  });

  await ctx.db
    .insertInto('avatarItems')
    .values({
      affixes: [],
      avatarId: avatar.id,
      baseId: 'rusty-sword',
      chainIndex: 4,
      contentVersion: '1',
      keyVersion: 1,
      ordinal: 1,
      rarityId: 'common',
      scopeId: '2_3',
      scopeType: 'world_map_node',
    })
    .execute();

  const checks = await readItemIdentityChecks(ctx.db);

  expect(checks[0]).toStrictEqual({
    area: 'item-identities',
    name: 'every item sits at a verified chain position',
    violations: [`item ${avatar.id}/world_map_node/2_3#4.1`],
  });
});

test('it reports two live activities whose appended positions overlap on one chain', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 5,
    avatarId: avatar.id,
    id: 'act_restored',
    scopeId: '2_3',
    startChainIndex: 0,
    status: 'stopped',
  });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_replayed',
    scopeId: '2_3',
    startChainIndex: 3,
    status: 'stopped',
  });

  const checks = await readItemIdentityChecks(ctx.db);

  expect(checks[1]).toStrictEqual({
    area: 'item-identities',
    name: 'no two live activities claim one chain position',
    violations: ['activities act_restored and act_replayed'],
  });
});

test('it accepts a successor at the start index of an activity that appended only its Started checkpoint', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 1,
    avatarId: avatar.id,
    scopeId: '2_3',
    startChainIndex: 5,
    startedAt: new Date('2026-10-20T08:00:00Z'),
    status: 'stopped',
  });

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: avatar.id,
    scopeId: '2_3',
    startChainIndex: 5,
    startedAt: new Date('2026-10-20T08:05:00Z'),
  });

  const checks = await readItemIdentityChecks(ctx.db);

  expect(checks[1]).toStrictEqual({
    area: 'item-identities',
    name: 'no two live activities claim one chain position',
    violations: [],
  });
});

test('it reports once two live activities that both draw from one start index', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 4,
    avatarId: avatar.id,
    id: 'act_device_history',
    scopeId: '2_3',
    startChainIndex: 5,
    startedAt: new Date('2026-10-20T08:00:00Z'),
    status: 'stopped',
  });

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: avatar.id,
    id: 'act_server_history',
    scopeId: '2_3',
    startChainIndex: 5,
    startedAt: new Date('2026-10-20T08:05:00Z'),
  });

  const checks = await readItemIdentityChecks(ctx.db);

  expect(checks[1]).toStrictEqual({
    area: 'item-identities',
    name: 'no two live activities claim one chain position',
    violations: ['activities act_device_history and act_server_history'],
  });
});

test('it reports an item whose content version is unpublished', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    scopeId: '2_3',
    startChainIndex: 0,
    status: 'stopped',
    verifiedHead: 2,
  });

  await ctx.db
    .insertInto('avatarItems')
    .values({
      affixes: [],
      avatarId: avatar.id,
      baseId: 'rusty-sword',
      chainIndex: 2,
      contentVersion: '9.9.9-missing',
      keyVersion: 1,
      ordinal: 0,
      rarityId: 'common',
      scopeId: '2_3',
      scopeType: 'world_map_node',
    })
    .execute();

  const checks = await readItemIdentityChecks(ctx.db);

  expect(checks[2]).toStrictEqual({
    area: 'item-identities',
    name: 'every item’s content version is published',
    violations: [`item ${avatar.id}/world_map_node/2_3#2.0`],
  });
});
