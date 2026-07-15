import { expect, test } from 'bun:test';
import { buildCheckpointHash } from '@vers/contract-activity';
import type { Json } from '@vers/db';
import { buildStateFromSeed } from '@vers/game-utils';
import { createSimulationDriver } from '@vers/idle-core/replay';
import { createTestDB, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import pino from 'pino';
import { MAX_REPLAY_ATTEMPTS } from '../queue/update-replay-attempts';
import { buildReplaySimulationInput } from '../replay/build-replay-simulation-input';
import { createReplayCache } from '../replay/create-replay-cache';
import { createActivityRow } from '../test-utils/create-activity-row';
import { createHonestActivityFixture } from '../test-utils/create-honest-activity-fixture';
import { runReplayIteration } from './run-replay-iteration';

/**
 * The worker's own `db.transaction()` per iteration commits mid-op across several calls in one
 * test — a rolled-back transaction can't nest that, so this suite runs against a real, committed
 * schema clone.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });
  const keyPair = await getTestServiceKeyPair();

  return {
    db: db.db,
    privateKey: keyPair.privateKey,
    [Symbol.asyncDispose]: db[Symbol.asyncDispose],
  };
}

test('it replays an honest full stream, matches, and advances the verified head exactly once', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const deps = {
    db: ctx.db,
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'matched' });

  const updated = await ctx.db
    .selectFrom('activities')
    .select(['replayAttempts', 'verifiedHead'])
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updated.verifiedHead).toBe(fixture.activity.appendedHead);
  expect(updated.replayAttempts).toBe(0);

  const idle = await runReplayIteration(deps, cache);

  expect(idle).toStrictEqual({ kind: 'idle' });
});

test('it verifies a later batch from held state, not a fresh from-Started replay', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const totalCheckpoints = fixture.checkpoints.length;
  const firstBatchCount = Math.floor(totalCheckpoints / 2);

  expect(firstBatchCount).toBeGreaterThan(0);
  expect(firstBatchCount).toBeLessThan(totalCheckpoints);

  await ctx.db
    .deleteFrom('activityCheckpoints')
    .where('activityId', '=', fixture.activity.id)
    .where('version', '>', firstBatchCount)
    .execute();

  const firstBatchLastHash = fixture.checkpoints[firstBatchCount - 1]?.hash;

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: firstBatchCount, lastHash: firstBatchLastHash })
    .where('id', '=', fixture.activity.id)
    .execute();

  const deps = {
    db: ctx.db,
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const firstOutcome = await runReplayIteration(deps, cache);

  expect(firstOutcome).toStrictEqual({ kind: 'matched' });

  const cachedAfterFirst = cache.get(fixture.activity.id);

  expect(cachedAfterFirst?.emittedCount).toBe(firstBatchCount);

  const remaining = fixture.checkpoints.slice(firstBatchCount);

  await ctx.db
    .insertInto('activityCheckpoints')
    .values(
      remaining.map((checkpoint) => ({
        activityId: fixture.activity.id,
        hash: checkpoint.hash,
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; the value is a hand-built, schema-shaped payload
        payload: checkpoint.payload as Json,
        prevHash: checkpoint.prevHash,
        version: checkpoint.version,
      })),
    )
    .execute();

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: totalCheckpoints, lastHash: fixture.checkpoints.at(-1)?.hash })
    .where('id', '=', fixture.activity.id)
    .execute();

  const secondOutcome = await runReplayIteration(deps, cache);

  expect(secondOutcome).toStrictEqual({ kind: 'matched' });

  const cachedAfterSecond = cache.get(fixture.activity.id);

  expect(cachedAfterSecond?.driver).toBe(cachedAfterFirst?.driver);
  expect(cachedAfterSecond?.emittedCount).toBe(totalCheckpoints);

  const updated = await ctx.db
    .selectFrom('activities')
    .select('verifiedHead')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updated.verifiedHead).toBe(totalCheckpoints);
});

test('it rejects a tampered nextSeed, rewinds the chain, and voids an active successor', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'stopped' },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const tamperedNextSeed = 'ff'.repeat(16);
  const targetVersion = 2;
  const target = fixture.checkpoints.find((checkpoint) => checkpoint.version === targetVersion);

  expect(target).toBeDefined();

  const tamperedPayload: Record<string, unknown> = {
    ...target?.payload,
    nextSeed: tamperedNextSeed,
  };

  // oxlint-disable typescript/no-unsafe-type-assertion -- the fixture's payload is a hand-built, schema-shaped object
  const tamperedHash = buildCheckpointHash({
    chainIndex: tamperedPayload['chainIndex'] as number,
    entropySource: 'server-key',
    nextSeed: tamperedNextSeed,
    prevHash: target?.prevHash ?? '',
    seed: tamperedPayload['seed'] as string,
    time: tamperedPayload['time'] as number,
    type: tamperedPayload['type'] as string,
    version: targetVersion,
  });

  // oxlint-enable typescript/no-unsafe-type-assertion

  await ctx.db
    .updateTable('activityCheckpoints')
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; the value is a hand-tampered, schema-shaped payload
    .set({ hash: tamperedHash, payload: tamperedPayload as Json })
    .where('activityId', '=', fixture.activity.id)
    .where('version', '=', targetVersion)
    .execute();

  const successor = await createActivityRow(ctx.db, {
    avatarId: fixture.activity.avatarId,
    scopeId: fixture.activity.scopeId,
    scopeType: fixture.activity.scopeType,
    startChainIndex: fixture.checkpoints.length + 10,
    status: 'active',
  });

  const deps = {
    db: ctx.db,
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'rejected' });

  const updatedActivity = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  const updatedChain = await ctx.db
    .selectFrom('activityChains')
    .select(['appendedChainIndex', 'appendedNextSeed'])
    .where('avatarId', '=', fixture.activity.avatarId)
    .where('scopeId', '=', fixture.activity.scopeId)
    .executeTakeFirstOrThrow();

  const updatedSuccessor = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', successor.id)
    .executeTakeFirstOrThrow();

  expect(updatedActivity.status).toBe('rejected');

  expect(updatedChain).toStrictEqual({
    appendedChainIndex: fixture.chain.verifiedChainIndex,
    appendedNextSeed: fixture.chain.verifiedNextSeed,
  });

  expect(updatedSuccessor.status).toBe('rejected');
});

test('it rejects a tampered chainIndex', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const targetVersion = 1;
  const target = fixture.checkpoints.find((checkpoint) => checkpoint.version === targetVersion);

  expect(target).toBeDefined();

  const tamperedPayload: Record<string, unknown> = { ...target?.payload, chainIndex: 999 };

  // oxlint-disable typescript/no-unsafe-type-assertion -- the fixture's payload is a hand-built, schema-shaped object
  const tamperedHash = buildCheckpointHash({
    chainIndex: 999,
    entropySource: 'server-key',
    nextSeed: tamperedPayload['nextSeed'] as string,
    prevHash: target?.prevHash ?? '',
    seed: tamperedPayload['seed'] as string,
    time: tamperedPayload['time'] as number,
    type: tamperedPayload['type'] as string,
    version: targetVersion,
  });

  // oxlint-enable typescript/no-unsafe-type-assertion

  await ctx.db
    .updateTable('activityCheckpoints')
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; the value is a hand-tampered, schema-shaped payload
    .set({ hash: tamperedHash, payload: tamperedPayload as Json })
    .where('activityId', '=', fixture.activity.id)
    .where('version', '=', targetVersion)
    .execute();

  const deps = {
    db: ctx.db,
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'rejected' });
});

test('it rejects a tampered entropySource tag', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const targetVersion = 1;
  const target = fixture.checkpoints.find((checkpoint) => checkpoint.version === targetVersion);

  expect(target).toBeDefined();

  const tamperedPayload: Record<string, unknown> = {
    ...target?.payload,
    entropySource: 'device-key',
  };

  // oxlint-disable typescript/no-unsafe-type-assertion -- the fixture's payload is a hand-built, schema-shaped object
  const tamperedHash = buildCheckpointHash({
    chainIndex: tamperedPayload['chainIndex'] as number,
    entropySource: 'device-key',
    nextSeed: tamperedPayload['nextSeed'] as string,
    prevHash: target?.prevHash ?? '',
    seed: tamperedPayload['seed'] as string,
    time: tamperedPayload['time'] as number,
    type: tamperedPayload['type'] as string,
    version: targetVersion,
  });

  // oxlint-enable typescript/no-unsafe-type-assertion

  await ctx.db
    .updateTable('activityCheckpoints')
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; the value is a hand-tampered, schema-shaped payload
    .set({ hash: tamperedHash, payload: tamperedPayload as Json })
    .where('activityId', '=', fixture.activity.id)
    .where('version', '=', targetVersion)
    .execute();

  const deps = {
    db: ctx.db,
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'rejected' });
});

test('it rejects a tampered rewards.xp', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const targetVersion = 1;

  await ctx.db
    .updateTable('activityCheckpoints')
    .set({
      payload: {
        ...fixture.checkpoints.find((c) => c.version === targetVersion)?.payload,
        rewards: { xp: 999_999 },
      } as Json,
    })
    .where('activityId', '=', fixture.activity.id)
    .where('version', '=', targetVersion)
    .execute();

  const deps = {
    db: ctx.db,
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'rejected' });
});

test('it rejects a wrong continuation seed', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  await ctx.db
    .updateTable('activities')
    .set({ seed: 'ff'.repeat(16) })
    .where('id', '=', fixture.activity.id)
    .execute();

  const deps = {
    db: ctx.db,
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'rejected' });

  const updatedActivity = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updatedActivity.status).toBe('rejected');
});

test('it parks an activity stamped with an unknown sim version', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  await ctx.db
    .updateTable('activities')
    .set({ simVersion: 'never-registered-hash' })
    .where('id', '=', fixture.activity.id)
    .execute();

  const deps = {
    db: ctx.db,
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'parked', reason: 'unknownVersion' });

  const updated = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updated.status).toBe('parked');
});

test('it parks an activity stamped with a retention-expired sim version', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  await ctx.db
    .updateTable('activities')
    .set({ simVersion: 'pruned-hash' })
    .where('id', '=', fixture.activity.id)
    .execute();

  await createSimVersionRow(ctx.db, { engineHash: 'pruned-hash', status: 'pruned' });

  const deps = {
    db: ctx.db,
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'parked', reason: 'expired' });
});

test('it counts a replay error as a failed attempt and quarantines at the attempt limit', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  await ctx.db
    .updateTable('activities')
    .set({ simVersion: 'unreachable-provider-hash' })
    .where('id', '=', fixture.activity.id)
    .execute();

  await createSimVersionRow(ctx.db, {
    engineHash: 'unreachable-provider-hash',
    providerUrl: 'http://127.0.0.1:1',
    retainedUntil: new Date(Date.now() + 86_400_000),
    status: 'active',
  });

  const deps = {
    db: ctx.db,
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  for (let attempt = 1; attempt < MAX_REPLAY_ATTEMPTS; attempt++) {
    const outcome = await runReplayIteration(deps, cache);

    expect(outcome).toStrictEqual({ kind: 'errored' });
  }

  const finalOutcome = await runReplayIteration(deps, cache);

  expect(finalOutcome).toStrictEqual({ kind: 'quarantined' });

  const updated = await ctx.db
    .selectFrom('activities')
    .select(['replayAttempts', 'status'])
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updated.status).toBe('quarantined');
  expect(updated.replayAttempts).toBe(MAX_REPLAY_ATTEMPTS);
});

test('it does not reject a divergence that fails to reproduce on the fresh confirm replay', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const totalCheckpoints = fixture.checkpoints.length;
  const firstBatchCount = Math.floor(totalCheckpoints / 2);

  expect(firstBatchCount).toBeGreaterThan(0);
  expect(firstBatchCount).toBeLessThan(totalCheckpoints);

  await ctx.db
    .updateTable('activities')
    .set({ verifiedHead: firstBatchCount })
    .where('id', '=', fixture.activity.id)
    .execute();

  const cache = createReplayCache();

  const corruptInput = buildReplaySimulationInput({
    avatarID: fixture.activity.avatarId,
    buildSnapshot: { level: 1, xp: 0 },
    id: fixture.activity.id,
    seed: 'ff'.repeat(16),
  });

  const corruptDriver = createSimulationDriver(corruptInput.activity, corruptInput.avatar);

  // oxlint-disable typescript/no-unsafe-type-assertion -- the fixture's payload is a hand-built, schema-shaped object
  await corruptDriver.advanceToDuration(
    fixture.checkpoints[firstBatchCount - 1]?.payload['time'] as number,
  );

  // oxlint-enable typescript/no-unsafe-type-assertion

  cache.set(fixture.activity.id, {
    driver: corruptDriver,
    emittedCount: firstBatchCount,
    lastHash: fixture.checkpoints[firstBatchCount - 1]?.hash ?? '',
  });

  const deps = {
    db: ctx.db,
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'unconfirmedDivergence' });

  const updated = await ctx.db
    .selectFrom('activities')
    .select(['replayAttempts', 'status'])
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updated.status).toBe('active');
  expect(updated.replayAttempts).toBe(1);
  expect(cache.get(fixture.activity.id)).toBeUndefined();
});

function buildSilentLogger() {
  return pino({ enabled: false });
}
