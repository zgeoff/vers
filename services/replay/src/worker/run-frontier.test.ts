import { expect, test } from 'bun:test';
import { buildStateFromSeed } from '@vers/game-utils';
import { buildLevelFromXP } from '@vers/idle-core';
import { resolveServiceURL } from '@vers/mock-services';
import { createTestDB, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import pino from 'pino';
import invariant from 'tiny-invariant';
import { createReplayCache } from '../replay/create-replay-cache';
import { createHonestActivityFixture } from '../test-utils/create-honest-activity-fixture';
import { runFrontier } from './run-frontier';

async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });
  const keyPair = await getTestServiceKeyPair();

  return {
    db: db.db,
    privateKey: keyPair.privateKey,
    [Symbol.asyncDispose]: db[Symbol.asyncDispose],
  };
}

test('it defers the cache mutation until the caller applies it, never touching the cache itself', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const totalCheckpoints = fixture.checkpoints.length;
  const firstBatchCount = totalCheckpoints - 1;

  await ctx.db
    .updateTable('activities')
    .set({
      appendedHead: firstBatchCount,
      lastHash: fixture.checkpoints[firstBatchCount - 1]?.hash,
    })
    .where('id', '=', fixture.activity.id)
    .execute();

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: pino({ enabled: false }),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const outcome = await ctx.db.transaction().execute((trx) =>
    runFrontier(trx, deps, cache, {
      activityID: fixture.activity.id,
      appendedHead: firstBatchCount,
      replayAttempts: 0,
      startChainIndex: fixture.activity.startChainIndex,
      status: fixture.activity.status,
      verifiedHead: 0,
    }),
  );

  expect(outcome.kind).toBe('matched');

  expect(outcome).toMatchObject({
    pendingCache: { activityID: fixture.activity.id, effect: { kind: 'set' } },
  });

  // runFrontier itself never wrote to the cache — only the caller applying the returned
  // mutation after a successful commit would.
  expect(cache.get(fixture.activity.id)).toBeUndefined();
});

test('it reports idle rather than throwing when the claimed activity row is gone', async () => {
  await using ctx = await setupTest();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: pino({ enabled: false }),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const outcome = await ctx.db.transaction().execute((trx) =>
    runFrontier(trx, deps, createReplayCache(), {
      activityID: 'act_gone',
      appendedHead: 3,
      replayAttempts: 0,
      startChainIndex: 0,
      status: 'active',
      verifiedHead: 0,
    }),
  );

  expect(outcome).toStrictEqual({ kind: 'idle' });
});

test('it settles the terminal checkpoint reward into the avatar xp and level on a matched terminal segment', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const terminal = fixture.engineCheckpoints.at(-1);

  invariant(terminal !== undefined, 'the fixture always ends on a checkpoint');
  expect(terminal.rewards.xp).toBeGreaterThan(0);

  // a non-zero baseline distinguishes the delta add from an absolute overwrite
  await ctx.db
    .updateTable('avatars')
    .set({ level: buildLevelFromXP(500), xp: 500 })
    .where('id', '=', fixture.activity.avatarId)
    .execute();

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: pino({ enabled: false }),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const outcome = await ctx.db.transaction().execute((trx) =>
    runFrontier(trx, deps, cache, {
      activityID: fixture.activity.id,
      appendedHead: fixture.activity.appendedHead,
      replayAttempts: 0,
      startChainIndex: fixture.activity.startChainIndex,
      status: fixture.activity.status,
      verifiedHead: 0,
    }),
  );

  expect(outcome.kind).toBe('matched');

  const avatar = await ctx.db
    .selectFrom('avatars')
    .select(['level', 'xp'])
    .where('id', '=', fixture.activity.avatarId)
    .executeTakeFirstOrThrow();

  expect(avatar.xp).toBe(500 + terminal.rewards.xp);
  expect(avatar.level).toBe(buildLevelFromXP(500 + terminal.rewards.xp));
});

test('it leaves the avatar xp and level untouched on a matched mid-run segment', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const totalCheckpoints = fixture.checkpoints.length;
  const midRunCount = totalCheckpoints - 1;

  expect(midRunCount).toBeGreaterThan(0);

  await ctx.db
    .deleteFrom('activityCheckpoints')
    .where('activityId', '=', fixture.activity.id)
    .where('version', '>', midRunCount)
    .execute();

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: midRunCount, lastHash: fixture.checkpoints[midRunCount - 1]?.hash })
    .where('id', '=', fixture.activity.id)
    .execute();

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: pino({ enabled: false }),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const outcome = await ctx.db.transaction().execute((trx) =>
    runFrontier(trx, deps, cache, {
      activityID: fixture.activity.id,
      appendedHead: midRunCount,
      replayAttempts: 0,
      startChainIndex: fixture.activity.startChainIndex,
      status: fixture.activity.status,
      verifiedHead: 0,
    }),
  );

  expect(outcome.kind).toBe('matched');

  const avatar = await ctx.db
    .selectFrom('avatars')
    .select(['level', 'xp'])
    .where('id', '=', fixture.activity.avatarId)
    .executeTakeFirstOrThrow();

  expect(avatar.xp).toBe(0);
  expect(avatar.level).toBe(1);
});

test('it settles no additional xp when a stale duplicate frontier misses the already-advanced cursor', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: pino({ enabled: false }),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const staleFrontier = {
    activityID: fixture.activity.id,
    appendedHead: fixture.activity.appendedHead,
    replayAttempts: 0,
    startChainIndex: fixture.activity.startChainIndex,
    status: fixture.activity.status,
    verifiedHead: 0,
  };

  const first = await ctx.db
    .transaction()
    .execute((trx) => runFrontier(trx, deps, cache, staleFrontier));

  expect(first.kind).toBe('matched');

  const afterFirst = await ctx.db
    .selectFrom('avatars')
    .select('xp')
    .where('id', '=', fixture.activity.avatarId)
    .executeTakeFirstOrThrow();

  // replays the same stale frontier, whose `verifiedHead` no longer matches the cursor the first
  // apply already advanced
  const second = await ctx.db
    .transaction()
    .execute((trx) => runFrontier(trx, deps, cache, staleFrontier));

  expect(second.kind).toBe('matched');

  const afterSecond = await ctx.db
    .selectFrom('avatars')
    .select('xp')
    .where('id', '=', fixture.activity.avatarId)
    .executeTakeFirstOrThrow();

  expect(afterSecond.xp).toBe(afterFirst.xp);
});
