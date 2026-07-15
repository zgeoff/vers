import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../test-utils/create-activity-row';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { createChainRow } from '../test-utils/create-chain-row';
import { applyVerifiedSegment } from './apply-verified-segment';

/**
 * `applyVerifiedSegment` opens its own `db.transaction()` when handed a non-transaction handle,
 * which can't nest under the default rollback-on-dispose isolation — this suite runs against a
 * real, committed schema clone instead.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it applies a duplicate segment exactly once', async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db, { xp: 100 });

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 5,
    avatarId: avatar.id,
  });

  const first = await applyVerifiedSegment(ctx.db, {
    activityID: activity.id,
    avatarID: avatar.id,
    expectedVerifiedHead: 0,
    verifiedHead: 5,
    xpDelta: 50,
  });

  const second = await applyVerifiedSegment(ctx.db, {
    activityID: activity.id,
    avatarID: avatar.id,
    expectedVerifiedHead: 0,
    verifiedHead: 5,
    xpDelta: 50,
  });

  expect(first).toStrictEqual({ applied: true, granted: [] });
  expect(second).toStrictEqual({ applied: false });

  const settled = await ctx.db
    .selectFrom('avatars')
    .select(['level', 'xp'])
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(settled.xp).toBe(150);

  const cursor = await ctx.db
    .selectFrom('activities')
    .select(['verifiedAt', 'verifiedHead'])
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(cursor.verifiedHead).toBe(5);
  expect(cursor.verifiedAt).toBeValidDate();
});

test('it grants a one-shot reward exactly once across re-farms', async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db);

  const firstRun = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: avatar.id,
    status: 'stopped',
  });

  const secondRun = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: avatar.id,
    scopeId: firstRun.scopeId,
    startChainIndex: 3,
  });

  const grant = { key: 'node_1', kind: 'first_clear' };

  const first = await applyVerifiedSegment(ctx.db, {
    activityID: firstRun.id,
    avatarID: avatar.id,
    expectedVerifiedHead: 0,
    grants: [grant],
    verifiedHead: 3,
  });

  const second = await applyVerifiedSegment(ctx.db, {
    activityID: secondRun.id,
    avatarID: avatar.id,
    expectedVerifiedHead: 0,
    grants: [grant],
    verifiedHead: 3,
  });

  expect(first).toStrictEqual({ applied: true, granted: [grant] });
  expect(second).toStrictEqual({ applied: true, granted: [] });

  const rows = await ctx.db
    .selectFrom('avatarGrants')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .execute();

  expect(rows).toHaveLength(1);
});

test('it advances the chain anchor forward only', async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db);

  const chain = await createChainRow(ctx.db, {
    avatarId: avatar.id,
    verifiedChainIndex: 10,
    verifiedNextSeed: 'aa'.repeat(16),
  });

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
  });

  const stale = await applyVerifiedSegment(ctx.db, {
    activityID: activity.id,
    avatarID: avatar.id,
    chain: {
      chainIndex: 4,
      nextSeed: 'bb'.repeat(16),
      scopeID: chain.scopeId,
      scopeType: chain.scopeType,
    },
    expectedVerifiedHead: 0,
    verifiedHead: 1,
  });

  expect(stale).toStrictEqual({ applied: true, granted: [] });

  const afterStale = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', avatar.id)
    .where('scopeId', '=', chain.scopeId)
    .executeTakeFirstOrThrow();

  expect(afterStale).toStrictEqual({
    verifiedChainIndex: 10,
    verifiedNextSeed: 'aa'.repeat(16),
  });

  await applyVerifiedSegment(ctx.db, {
    activityID: activity.id,
    avatarID: avatar.id,
    chain: {
      chainIndex: 12,
      nextSeed: 'cc'.repeat(16),
      scopeID: chain.scopeId,
      scopeType: chain.scopeType,
    },
    expectedVerifiedHead: 1,
    verifiedHead: 2,
  });

  const afterAdvance = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', avatar.id)
    .where('scopeId', '=', chain.scopeId)
    .executeTakeFirstOrThrow();

  expect(afterAdvance).toStrictEqual({
    verifiedChainIndex: 12,
    verifiedNextSeed: 'cc'.repeat(16),
  });
});

test('it floors xp at zero on an adverse delta', async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db, { xp: 10 });
  const activity = await createActivityRow(ctx.db, { appendedHead: 1, avatarId: avatar.id });

  await applyVerifiedSegment(ctx.db, {
    activityID: activity.id,
    avatarID: avatar.id,
    expectedVerifiedHead: 0,
    verifiedHead: 1,
    xpDelta: -50,
  });

  const settled = await ctx.db
    .selectFrom('avatars')
    .select('xp')
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(settled.xp).toBe(0);
});

test('it resets the attempt counter on a successful apply', async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db);

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 1,
    avatarId: avatar.id,
    replayAttempts: 3,
  });

  await applyVerifiedSegment(ctx.db, {
    activityID: activity.id,
    avatarID: avatar.id,
    expectedVerifiedHead: 0,
    verifiedHead: 1,
  });

  const row = await ctx.db
    .selectFrom('activities')
    .select('replayAttempts')
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row.replayAttempts).toBe(0);
});

test('it mints reward items alongside the verified anchor', async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db);

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 1,
    avatarId: avatar.id,
  });

  const item = {
    affixes: [{ affixID: 'affix_1', groupID: 'group_1', value: 5 }],
    baseID: 'base_sword',
    chainIndex: activity.startChainIndex + 1,
    contentVersion: 'v1',
    keyVersion: 1,
    ordinal: 0,
    rarityID: 'common',
    scopeID: activity.scopeId,
    scopeType: activity.scopeType,
  };

  await applyVerifiedSegment(ctx.db, {
    activityID: activity.id,
    avatarID: avatar.id,
    expectedVerifiedHead: 0,
    items: [item],
    verifiedHead: 1,
  });

  const rows = await ctx.db
    .selectFrom('avatarItems')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .execute();

  expect(rows).toHaveLength(1);

  expect(rows[0]).toMatchObject({
    affixes: item.affixes,
    baseId: item.baseID,
    chainIndex: item.chainIndex,
    ordinal: item.ordinal,
    rarityId: item.rarityID,
  });
});

test('it leaves one minted row set across a re-verified double apply', async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db);

  const firstRun = await createActivityRow(ctx.db, {
    appendedHead: 1,
    avatarId: avatar.id,
    status: 'stopped',
  });

  const secondRun = await createActivityRow(ctx.db, {
    appendedHead: 1,
    avatarId: avatar.id,
    scopeId: firstRun.scopeId,
    startChainIndex: 1,
  });

  const item = {
    affixes: [],
    baseID: 'base_sword',
    chainIndex: firstRun.startChainIndex + 1,
    contentVersion: 'v1',
    keyVersion: 1,
    ordinal: 0,
    rarityID: 'common',
    scopeID: firstRun.scopeId,
    scopeType: firstRun.scopeType,
  };

  await applyVerifiedSegment(ctx.db, {
    activityID: firstRun.id,
    avatarID: avatar.id,
    expectedVerifiedHead: 0,
    items: [item],
    verifiedHead: 1,
  });

  await applyVerifiedSegment(ctx.db, {
    activityID: secondRun.id,
    avatarID: avatar.id,
    expectedVerifiedHead: 0,
    items: [item],
    verifiedHead: 1,
  });

  const rows = await ctx.db
    .selectFrom('avatarItems')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .execute();

  expect(rows).toHaveLength(1);
});
