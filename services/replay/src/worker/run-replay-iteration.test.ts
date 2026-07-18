import { expect, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/bun';
import { buildCheckpointHash } from '@vers/contract-activity';
import type { Json } from '@vers/db';
import { buildStateFromSeed } from '@vers/game-utils';
import { buildSimulationInput } from '@vers/idle-core';
import { createSimulationDriver } from '@vers/idle-core/replay';
import { resolveServiceURL } from '@vers/mock-services';
import { setSentryHandleForTesting, startErrorReporting } from '@vers/service-runtime';
import { createTestDB, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { withTraceContext } from '@vers/service-utils';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { waitFor } from '@vers/test-utils';
import { createTraceContext } from '@vers/trace';
import pino from 'pino';
import { MAX_REPLAY_ATTEMPTS } from '../queue/update-replay-attempts';
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
    keysServiceURL: resolveServiceURL('keys'),
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

test('it mints one reward per slot earned by the verified stream', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  await runReplayIteration(deps, cache);

  const expectedSlotCount = fixture.engineCheckpoints.reduce(
    (total, checkpoint) => total + checkpoint.rewardSlots.length,
    0,
  );

  expect(expectedSlotCount).toBeGreaterThan(0);

  const rows = await ctx.db
    .selectFrom('avatarItems')
    .selectAll()
    .where('avatarId', '=', fixture.activity.avatarId)
    .execute();

  expect(rows).toHaveLength(expectedSlotCount);

  const maxChainIndex = fixture.activity.startChainIndex + fixture.activity.appendedHead;

  for (const row of rows) {
    expect(row.chainIndex).toBeGreaterThan(fixture.activity.startChainIndex);
    expect(row.chainIndex).toBeLessThanOrEqual(maxChainIndex);
  }
});

test('it verifies a later batch from held state, not a fresh from-Started replay', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const totalCheckpoints = fixture.checkpoints.length;

  // The stored stream carries only one terminal checkpoint, always its last — splitting one
  // short of the end keeps both batches non-terminal, so the driver stays cached across both.
  const secondBatchCount = totalCheckpoints - 1;
  const firstBatchCount = Math.max(1, Math.floor(secondBatchCount / 2));

  expect(firstBatchCount).toBeGreaterThan(0);
  expect(firstBatchCount).toBeLessThan(secondBatchCount);

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
    keysServiceURL: resolveServiceURL('keys'),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const firstOutcome = await runReplayIteration(deps, cache);

  expect(firstOutcome).toStrictEqual({ kind: 'matched' });

  const cachedAfterFirst = cache.get(fixture.activity.id);

  expect(cachedAfterFirst?.emittedCount).toBe(firstBatchCount);

  const remaining = fixture.checkpoints.slice(firstBatchCount, secondBatchCount);

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
    .set({
      appendedHead: secondBatchCount,
      lastHash: fixture.checkpoints[secondBatchCount - 1]?.hash,
    })
    .where('id', '=', fixture.activity.id)
    .execute();

  const secondOutcome = await runReplayIteration(deps, cache);

  expect(secondOutcome).toStrictEqual({ kind: 'matched' });

  const cachedAfterSecond = cache.get(fixture.activity.id);

  expect(cachedAfterSecond?.driver).toBe(cachedAfterFirst?.driver);
  expect(cachedAfterSecond?.emittedCount).toBe(secondBatchCount);

  const updated = await ctx.db
    .selectFrom('activities')
    .select('verifiedHead')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updated.verifiedHead).toBe(secondBatchCount);
});

test('it rejects a checkpoint with a forged continuation seed, rewinds the chain, and voids an active successor', async () => {
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
    keysServiceURL: resolveServiceURL('keys'),
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

test('it rejects a checkpoint with a forged chain position', async () => {
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
    keysServiceURL: resolveServiceURL('keys'),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'rejected' });
});

test('it rejects a checkpoint claiming the wrong entropy source', async () => {
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
    keysServiceURL: resolveServiceURL('keys'),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'rejected' });
});

test('it rejects a checkpoint with a forged reward total', async () => {
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
    keysServiceURL: resolveServiceURL('keys'),
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
    keysServiceURL: resolveServiceURL('keys'),
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
    keysServiceURL: resolveServiceURL('keys'),
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
    keysServiceURL: resolveServiceURL('keys'),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'parked', reason: 'expired' });
});

test('it parks rather than rejects when the duration cap trips before the expected checkpoint count', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  // A claimed time far below what the stored stream actually took sizes a duration cap the
  // engine can't reach even on a fresh, honest replay — an operational bound trip, not evidence
  // the stream itself is dishonest.
  await ctx.db
    .updateTable('activities')
    .set({ appendedTimeMs: 100 })
    .where('id', '=', fixture.activity.id)
    .execute();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'parked', reason: 'durationCapExceeded' });

  const updated = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updated.status).toBe('parked');
});

test('it evicts and rebuilds from Started when the cached driver no longer matches the loaded segment', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const totalCheckpoints = fixture.checkpoints.length;
  const firstBatchCount = totalCheckpoints - 1;

  await ctx.db
    .updateTable('activities')
    .set({ verifiedHead: firstBatchCount })
    .where('id', '=', fixture.activity.id)
    .execute();

  const cache = createReplayCache();

  // A cache entry keyed to this activity but stamped with coordinates from a different point in
  // the stream — the state a stale or mismatched resume would leave behind.
  cache.set(fixture.activity.id, {
    driver: createSimulationDriver(
      buildSimulationInput({
        avatarID: fixture.activity.avatarId,
        buildSnapshot: { level: 1, xp: 0 },
        contentVersion: fixture.activity.contentVersion,
        id: fixture.activity.id,
        seed: fixture.activity.seed,
      }).activity,
      buildSimulationInput({
        avatarID: fixture.activity.avatarId,
        buildSnapshot: { level: 1, xp: 0 },
        contentVersion: fixture.activity.contentVersion,
        id: fixture.activity.id,
        seed: fixture.activity.seed,
      }).avatar,
    ),
    emittedCount: firstBatchCount,
    lastHash: 'stale-hash-not-the-real-predecessor',
  });

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'matched' });

  const updated = await ctx.db
    .selectFrom('activities')
    .select('verifiedHead')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updated.verifiedHead).toBe(totalCheckpoints);
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
    keysServiceURL: resolveServiceURL('keys'),
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

test('it reports an iteration failure exactly once when a frontier was claimed', async () => {
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
    keysServiceURL: resolveServiceURL('keys'),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();
  const recorded: Array<Readonly<ErrorEvent>> = [];
  const previousHandle = setSentryHandleForTesting(undefined);

  onTestFinished(() => {
    setSentryHandleForTesting(previousHandle);
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const trace = createTraceContext();

  const outcome = await withTraceContext(trace, () => runReplayIteration(deps, cache));

  expect(outcome).toStrictEqual({ kind: 'errored' });

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(recorded[0]?.tags).toMatchObject({ traceID: trace.traceID });
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

  const corruptInput = buildSimulationInput({
    avatarID: fixture.activity.avatarId,
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: fixture.activity.contentVersion,
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
    keysServiceURL: resolveServiceURL('keys'),
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

test('a user-stopped activity advances the chain verified anchor from its tail, and an honest successor verifies', async () => {
  await using ctx = await setupTest();

  const predecessor = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'stopped' },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const tailCount = predecessor.checkpoints.length - 1;
  const tail = predecessor.checkpoints[tailCount - 1];

  expect(tail).toBeDefined();

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: tailCount, lastHash: tail?.hash })
    .where('id', '=', predecessor.activity.id)
    .execute();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const predecessorOutcome = await runReplayIteration(deps, cache);

  expect(predecessorOutcome).toStrictEqual({ kind: 'matched' });

  // oxlint-disable typescript/no-unsafe-type-assertion -- the fixture's payload is a hand-built, schema-shaped object
  const expectedAnchor = {
    verifiedChainIndex: tail?.payload['chainIndex'] as number,
    verifiedNextSeed: tail?.payload['nextSeed'] as string,
  };

  // oxlint-enable typescript/no-unsafe-type-assertion

  const chainAfterPredecessor = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', predecessor.activity.avatarId)
    .where('scopeId', '=', predecessor.activity.scopeId)
    .executeTakeFirstOrThrow();

  expect(chainAfterPredecessor).toStrictEqual(expectedAnchor);

  const successor = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    rootChain: predecessor.chain,
    seed: expectedAnchor.verifiedNextSeed,
    startChainIndex: expectedAnchor.verifiedChainIndex,
  });

  const successorOutcome = await runReplayIteration(deps, cache);

  expect(successorOutcome).toStrictEqual({ kind: 'matched' });

  const successorRow = await ctx.db
    .selectFrom('activities')
    .select('verifiedHead')
    .where('id', '=', successor.activity.id)
    .executeTakeFirstOrThrow();

  expect(successorRow.verifiedHead).toBe(successor.activity.appendedHead);
});

test('a capped activity advances the chain verified anchor from its tail, and an honest successor verifies', async () => {
  await using ctx = await setupTest();

  const predecessor = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'capped' },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const tailCount = predecessor.checkpoints.length - 1;
  const tail = predecessor.checkpoints[tailCount - 1];

  expect(tail).toBeDefined();

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: tailCount, lastHash: tail?.hash })
    .where('id', '=', predecessor.activity.id)
    .execute();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const predecessorOutcome = await runReplayIteration(deps, cache);

  expect(predecessorOutcome).toStrictEqual({ kind: 'matched' });

  // oxlint-disable typescript/no-unsafe-type-assertion -- the fixture's payload is a hand-built, schema-shaped object
  const expectedAnchor = {
    verifiedChainIndex: tail?.payload['chainIndex'] as number,
    verifiedNextSeed: tail?.payload['nextSeed'] as string,
  };

  // oxlint-enable typescript/no-unsafe-type-assertion

  const chainAfterPredecessor = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', predecessor.activity.avatarId)
    .where('scopeId', '=', predecessor.activity.scopeId)
    .executeTakeFirstOrThrow();

  expect(chainAfterPredecessor).toStrictEqual(expectedAnchor);

  const successor = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    rootChain: predecessor.chain,
    seed: expectedAnchor.verifiedNextSeed,
    startChainIndex: expectedAnchor.verifiedChainIndex,
  });

  const successorOutcome = await runReplayIteration(deps, cache);

  expect(successorOutcome).toStrictEqual({ kind: 'matched' });

  const successorRow = await ctx.db
    .selectFrom('activities')
    .select('verifiedHead')
    .where('id', '=', successor.activity.id)
    .executeTakeFirstOrThrow();

  expect(successorRow.verifiedHead).toBe(successor.activity.appendedHead);
});

test('a stream fully verified while still active reconciles the anchor once a successor claims a forward-exited predecessor position', async () => {
  await using ctx = await setupTest();

  const predecessor = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const tailCount = predecessor.checkpoints.length - 1;
  const tail = predecessor.checkpoints[tailCount - 1];

  expect(tail).toBeDefined();

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: tailCount, lastHash: tail?.hash })
    .where('id', '=', predecessor.activity.id)
    .execute();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const verifyOutcome = await runReplayIteration(deps, cache);

  expect(verifyOutcome).toStrictEqual({ kind: 'matched' });

  const chainWhileActive = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', predecessor.activity.avatarId)
    .where('scopeId', '=', predecessor.activity.scopeId)
    .executeTakeFirstOrThrow();

  expect(chainWhileActive).toStrictEqual({
    verifiedChainIndex: predecessor.chain.verifiedChainIndex,
    verifiedNextSeed: predecessor.chain.verifiedNextSeed,
  });

  // Fully verified and still active, the stream is no longer a frontier — nothing revisits it.
  const idleOutcome = await runReplayIteration(deps, cache);

  expect(idleOutcome).toStrictEqual({ kind: 'idle' });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'stopped' })
    .where('id', '=', predecessor.activity.id)
    .execute();

  // oxlint-disable typescript/no-unsafe-type-assertion -- the fixture's payload is a hand-built, schema-shaped object
  const expectedAnchor = {
    verifiedChainIndex: tail?.payload['chainIndex'] as number,
    verifiedNextSeed: tail?.payload['nextSeed'] as string,
  };

  // oxlint-enable typescript/no-unsafe-type-assertion

  const successor = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    rootChain: predecessor.chain,
    seed: expectedAnchor.verifiedNextSeed,
    startChainIndex: expectedAnchor.verifiedChainIndex,
  });

  const successorOutcome = await runReplayIteration(deps, cache);

  expect(successorOutcome).toStrictEqual({ kind: 'matched' });

  const chainAfterReconcile = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', predecessor.activity.avatarId)
    .where('scopeId', '=', predecessor.activity.scopeId)
    .executeTakeFirstOrThrow();

  expect(chainAfterReconcile).toStrictEqual(expectedAnchor);

  const successorRow = await ctx.db
    .selectFrom('activities')
    .select('verifiedHead')
    .where('id', '=', successor.activity.id)
    .executeTakeFirstOrThrow();

  expect(successorRow.verifiedHead).toBe(successor.activity.appendedHead);
});

test('a stopped activity whose only checkpoint is Started leaves the anchor untouched, and an honest successor verifies from it', async () => {
  await using ctx = await setupTest();

  const predecessor = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'stopped' },
    duration: 1,
    seed: buildStateFromSeed(3_047_525_658),
  });

  expect(predecessor.checkpoints).toHaveLength(1);
  expect(predecessor.checkpoints[0]?.payload['type']).toBe('started');

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const predecessorOutcome = await runReplayIteration(deps, cache);

  expect(predecessorOutcome).toStrictEqual({ kind: 'matched' });

  const chainAfterPredecessor = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', predecessor.activity.avatarId)
    .where('scopeId', '=', predecessor.activity.scopeId)
    .executeTakeFirstOrThrow();

  expect(chainAfterPredecessor).toStrictEqual({
    verifiedChainIndex: predecessor.chain.verifiedChainIndex,
    verifiedNextSeed: predecessor.chain.verifiedNextSeed,
  });

  const successor = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    rootChain: predecessor.chain,
    seed: predecessor.chain.verifiedNextSeed,
    startChainIndex: predecessor.chain.verifiedChainIndex,
  });

  const successorOutcome = await runReplayIteration(deps, cache);

  expect(successorOutcome).toStrictEqual({ kind: 'matched' });

  const successorRow = await ctx.db
    .selectFrom('activities')
    .select('verifiedHead')
    .where('id', '=', successor.activity.id)
    .executeTakeFirstOrThrow();

  expect(successorRow.verifiedHead).toBe(successor.activity.appendedHead);
});

function buildSilentLogger() {
  return pino({ enabled: false });
}
