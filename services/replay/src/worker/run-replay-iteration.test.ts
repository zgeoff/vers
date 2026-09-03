import { expect, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/bun';
import { createContentVersion, makeContentDocumentLoader } from '@vers/content-registry';
import { buildCheckpointHash } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { toJSON } from '@vers/db';
import { buildStateFromSeed } from '@vers/game-utils';
import { buildLevelFromXP, buildSimulationInput } from '@vers/idle-core';
import { createSimulationDriver } from '@vers/idle-core/replay';
import { resolveServiceURL } from '@vers/mock-services';
import { setSentryHandleForTesting, startErrorReporting } from '@vers/service-runtime';
import { createTestDB, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { withTraceContext } from '@vers/service-utils';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { waitFor } from '@vers/test-utils';
import { createTraceContext } from '@vers/trace';
import pino from 'pino';
import invariant from 'tiny-invariant';
import { MAX_REPLAY_ATTEMPTS } from '../queue/update-replay-attempts';
import { createReplayCache } from '../replay/create-replay-cache';
import { createActivityRow } from '../test-utils/create-activity-row';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { createHonestActivityFixture } from '../test-utils/create-honest-activity-fixture';
import { createRemoteReplayProvider } from '../test-utils/create-remote-replay-provider';
import { runReplayIteration } from './run-replay-iteration';

// the worker's own `db.transaction()` per iteration commits mid-test across several calls, which
// a rolled-back transaction cannot nest, so this suite runs against a committed clone
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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
        payload: toJSON(checkpoint.payload),
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

  invariant(target, 'the fixture always stores a checkpoint at the tampered version');

  const tamperedPayload = { ...target.payload, nextSeed: tamperedNextSeed };

  const tamperedHash = buildCheckpointHash({
    chainIndex: tamperedPayload.chainIndex,
    entropySource: 'server-key',
    nextSeed: tamperedNextSeed,
    prevHash: target.prevHash,
    seed: tamperedPayload.seed,
    time: tamperedPayload.time,
    type: tamperedPayload.type,
    version: targetVersion,
  });

  await ctx.db
    .updateTable('activityCheckpoints')
    .set({ hash: tamperedHash, payload: toJSON(tamperedPayload) })
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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

test('it settles no xp and drops the rejected activity from the pending anchor when a checkpoint is forged', async () => {
  await using ctx = await setupTest();

  // a non-zero baseline proves rejection preserves legitimately settled progression rather than
  // passing because there was nothing to lose
  const fixture = await createHonestActivityFixture(ctx.db, {
    buildSnapshot: { level: buildLevelFromXP(500), xp: 500 },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const targetVersion = 1;
  const target = fixture.checkpoints.find((checkpoint) => checkpoint.version === targetVersion);

  invariant(target, 'the fixture always stores a checkpoint at the tampered version');

  const tamperedPayload = { ...target.payload, chainIndex: 999 };

  const tamperedHash = buildCheckpointHash({
    chainIndex: 999,
    entropySource: 'server-key',
    nextSeed: tamperedPayload.nextSeed,
    prevHash: target.prevHash,
    seed: tamperedPayload.seed,
    time: tamperedPayload.time,
    type: tamperedPayload.type,
    version: targetVersion,
  });

  await ctx.db
    .updateTable('activityCheckpoints')
    .set({ hash: tamperedHash, payload: toJSON(tamperedPayload) })
    .where('activityId', '=', fixture.activity.id)
    .where('version', '=', targetVersion)
    .execute();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'rejected' });

  const updatedActivity = await ctx.db
    .selectFrom('activities')
    .select(['appendedHead', 'status', 'verifiedHead'])
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  // rejected excludes the activity from the pending predicate outright, regardless of its
  // unsettled head gap
  expect(updatedActivity.status).toBe('rejected');
  expect(updatedActivity.verifiedHead).toBeLessThan(updatedActivity.appendedHead);

  const avatar = await ctx.db
    .selectFrom('avatars')
    .select(['level', 'xp'])
    .where('id', '=', fixture.activity.avatarId)
    .executeTakeFirstOrThrow();

  expect(avatar.xp).toBe(500);
  expect(avatar.level).toBe(buildLevelFromXP(500));
});

test('it rejects a checkpoint with a forged chain position', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const targetVersion = 1;
  const target = fixture.checkpoints.find((checkpoint) => checkpoint.version === targetVersion);

  invariant(target, 'the fixture always stores a checkpoint at the tampered version');

  const tamperedPayload = { ...target.payload, chainIndex: 999 };

  const tamperedHash = buildCheckpointHash({
    chainIndex: 999,
    entropySource: 'server-key',
    nextSeed: tamperedPayload.nextSeed,
    prevHash: target.prevHash,
    seed: tamperedPayload.seed,
    time: tamperedPayload.time,
    type: tamperedPayload.type,
    version: targetVersion,
  });

  await ctx.db
    .updateTable('activityCheckpoints')
    .set({ hash: tamperedHash, payload: toJSON(tamperedPayload) })
    .where('activityId', '=', fixture.activity.id)
    .where('version', '=', targetVersion)
    .execute();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  invariant(target, 'the fixture always stores a checkpoint at the tampered version');

  const tamperedPayload = { ...target.payload, entropySource: 'device-key' };

  const tamperedHash = buildCheckpointHash({
    chainIndex: tamperedPayload.chainIndex,
    entropySource: 'device-key',
    nextSeed: tamperedPayload.nextSeed,
    prevHash: target.prevHash,
    seed: tamperedPayload.seed,
    time: tamperedPayload.time,
    type: tamperedPayload.type,
    version: targetVersion,
  });

  await ctx.db
    .updateTable('activityCheckpoints')
    .set({ hash: tamperedHash, payload: toJSON(tamperedPayload) })
    .where('activityId', '=', fixture.activity.id)
    .where('version', '=', targetVersion)
    .execute();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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
  const target = fixture.checkpoints.find((checkpoint) => checkpoint.version === targetVersion);

  invariant(target, 'the fixture always stores a checkpoint at the tampered version');

  await ctx.db
    .updateTable('activityCheckpoints')
    .set({ payload: toJSON({ ...target.payload, rewards: { xp: 999_999 } }) })
    .where('activityId', '=', fixture.activity.id)
    .where('version', '=', targetVersion)
    .execute();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

test('it parks a stopped activity, leaving its chain claimable again', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  await ctx.db
    .updateTable('activities')
    .set({ simVersion: 'never-registered-hash', status: 'stopped' })
    .where('id', '=', fixture.activity.id)
    .execute();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'parked', reason: 'unknownVersion' });

  const updated = await ctx.db
    .selectFrom('activities')
    .select(['parkedFrom', 'status'])
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updated).toStrictEqual({ parkedFrom: 'stopped', status: 'parked' });

  const next = await runReplayIteration(deps, cache);

  expect(next).toStrictEqual({ kind: 'idle' });
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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

test('it parks an activity without incrementing its attempt count when the provider is unavailable', async () => {
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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const outcome = await runReplayIteration(deps, cache);

  expect(outcome).toStrictEqual({ kind: 'parked', reason: 'providerUnavailable' });

  const updated = await ctx.db
    .selectFrom('activities')
    .select(['replayAttempts', 'status'])
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updated.status).toBe('parked');
  expect(updated.replayAttempts).toBe(0);
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
  const staleContent = createMockContentDocument({ contentVersion: '2' }).encounter;

  const staleInput = buildSimulationInput(staleContent, {
    avatarID: fixture.activity.avatarId,
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: fixture.activity.contentVersion,
    encounterNode: { difficulty: 1 },
    id: fixture.activity.id,
    seed: fixture.activity.seed,
  });

  // A cache entry keyed to this activity but stamped with coordinates from a different point in
  // the stream — the state a stale or mismatched resume would leave behind.
  cache.set(fixture.activity.id, {
    driver: createSimulationDriver(staleInput.activity, staleInput.avatar),
    emittedCount: firstBatchCount,
    lastHash: 'stale-hash-not-the-real-predecessor',
  });

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  const remote = await createRemoteReplayProvider('providers-actual-hash');

  await ctx.db
    .updateTable('activities')
    .set({ simVersion: 'stamped-hash-the-provider-disowns' })
    .where('id', '=', fixture.activity.id)
    .execute();

  await createSimVersionRow(ctx.db, {
    engineHash: 'stamped-hash-the-provider-disowns',
    providerUrl: remote.url,
    retainedUntil: new Date(Date.now() + 86_400_000),
    status: 'active',
  });

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

test('it reports an iteration failure exactly once when a target was claimed', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const remote = await createRemoteReplayProvider('providers-actual-hash');

  await ctx.db
    .updateTable('activities')
    .set({ simVersion: 'stamped-hash-the-provider-disowns' })
    .where('id', '=', fixture.activity.id)
    .execute();

  await createSimVersionRow(ctx.db, {
    engineHash: 'stamped-hash-the-provider-disowns',
    providerUrl: remote.url,
    retainedUntil: new Date(Date.now() + 86_400_000),
    status: 'active',
  });

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  const corruptInput = buildSimulationInput(
    createMockContentDocument({ contentVersion: '2' }).encounter,
    {
      avatarID: fixture.activity.avatarId,
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: fixture.activity.contentVersion,
      encounterNode: { difficulty: 1 },
      id: fixture.activity.id,
      seed: 'ff'.repeat(16),
    },
  );

  const corruptDriver = createSimulationDriver(corruptInput.activity, corruptInput.avatar);
  const resumePoint = fixture.checkpoints[firstBatchCount - 1];

  invariant(resumePoint, 'the fixture always stores a checkpoint at the cached head');

  await corruptDriver.advanceToDuration(resumePoint.payload.time);

  cache.set(fixture.activity.id, {
    driver: corruptDriver,
    emittedCount: firstBatchCount,
    lastHash: resumePoint.hash,
  });

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

test("it advances the chain verified anchor from a user-stopped activity's tail, and an honest successor verifies", async () => {
  await using ctx = await setupTest();

  const predecessor = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'stopped' },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const tailCount = predecessor.checkpoints.length - 1;
  const tail = predecessor.checkpoints[tailCount - 1];

  invariant(tail, 'the fixture always stores a checkpoint at the trimmed tail');

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: tailCount, lastHash: tail.hash })
    .where('id', '=', predecessor.activity.id)
    .execute();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const predecessorOutcome = await runReplayIteration(deps, cache);

  expect(predecessorOutcome).toStrictEqual({ kind: 'matched' });

  const expectedAnchor = {
    verifiedChainIndex: tail.payload.chainIndex,
    verifiedNextSeed: tail.payload.nextSeed,
  };

  const chainAfterPredecessor = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', predecessor.activity.avatarId)
    .where('scopeId', '=', predecessor.activity.scopeId)
    .executeTakeFirstOrThrow();

  expect(chainAfterPredecessor).toStrictEqual(expectedAnchor);

  const successor = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    chainRow: predecessor.chain,
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

test("it advances the chain verified anchor from a capped activity's tail, and an honest successor verifies", async () => {
  await using ctx = await setupTest();

  const predecessor = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'capped' },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const tailCount = predecessor.checkpoints.length - 1;
  const tail = predecessor.checkpoints[tailCount - 1];

  invariant(tail, 'the fixture always stores a checkpoint at the trimmed tail');

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: tailCount, lastHash: tail.hash })
    .where('id', '=', predecessor.activity.id)
    .execute();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
    logger: buildSilentLogger(),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const cache = createReplayCache();

  const predecessorOutcome = await runReplayIteration(deps, cache);

  expect(predecessorOutcome).toStrictEqual({ kind: 'matched' });

  const expectedAnchor = {
    verifiedChainIndex: tail.payload.chainIndex,
    verifiedNextSeed: tail.payload.nextSeed,
  };

  const chainAfterPredecessor = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', predecessor.activity.avatarId)
    .where('scopeId', '=', predecessor.activity.scopeId)
    .executeTakeFirstOrThrow();

  expect(chainAfterPredecessor).toStrictEqual(expectedAnchor);

  const successor = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    chainRow: predecessor.chain,
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

test('it reconciles the anchor once a successor claims a forward-exited predecessor position for a stream fully verified while still active', async () => {
  await using ctx = await setupTest();

  // A pinned avatar id keeps the sealed content derivation — and with it both fixtures' checkpoint
  // timelines — identical across runs; a random id would re-derive a different pool each run.
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_reconcile' });

  const predecessor = await createHonestActivityFixture(ctx.db, {
    avatarID: avatar.id,
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const tailCount = predecessor.checkpoints.length - 1;
  const tail = predecessor.checkpoints[tailCount - 1];

  invariant(tail, 'the fixture always stores a checkpoint at the trimmed tail');

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: tailCount, lastHash: tail.hash })
    .where('id', '=', predecessor.activity.id)
    .execute();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  // Fully verified and still active, the stream is no longer a target — nothing revisits it.
  const idleOutcome = await runReplayIteration(deps, cache);

  expect(idleOutcome).toStrictEqual({ kind: 'idle' });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'stopped' })
    .where('id', '=', predecessor.activity.id)
    .execute();

  const expectedAnchor = {
    verifiedChainIndex: tail.payload.chainIndex,
    verifiedNextSeed: tail.payload.nextSeed,
  };

  // This reconciled seed's authored encounter resolves to a terminal checkpoint at 66,250ms of
  // simulated time; a 60s duration keeps the successor mid-run so its own match never advances
  // the chain, leaving the reconciliation above as the only write to assert against.
  const successor = await createHonestActivityFixture(ctx.db, {
    duration: 60_000,
    chainRow: predecessor.chain,
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

test('it leaves the anchor untouched for a stopped activity whose only checkpoint is Started, and an honest successor verifies from it', async () => {
  await using ctx = await setupTest();

  const predecessor = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'stopped' },
    duration: 1,
    seed: buildStateFromSeed(3_047_525_658),
  });

  expect(predecessor.checkpoints).toHaveLength(1);
  expect(predecessor.checkpoints[0]?.payload.type).toBe('started');

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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
    chainRow: predecessor.chain,
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
