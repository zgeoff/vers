import { expect, test } from 'bun:test';
import { createContentVersion, makeContentDocumentLoader } from '@vers/content-registry';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { buildStateFromSeed } from '@vers/game-utils';
import { ActivityCheckpointType, buildLevelFromXP, buildXPThreshold } from '@vers/idle-core';
import { resolveServiceURL } from '@vers/mock-services';
import { mockKeysService } from '@vers/mock-services/keys';
import { createTestDB, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { ORIGIN_CELL, toNodeID } from '@vers/worldmap-core';
import pino from 'pino';
import invariant from 'tiny-invariant';
import { server } from '../mocks/server';
import { createReplayCache } from '../replay/create-replay-cache';
import { createActivityRow } from '../test-utils/create-activity-row';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { createHonestActivityFixture } from '../test-utils/create-honest-activity-fixture';
import { runFrontier } from './run-frontier';

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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  // a non-zero baseline distinguishes the delta add from an absolute overwrite
  const fixture = await createHonestActivityFixture(ctx.db, {
    buildSnapshot: { level: buildLevelFromXP(500), xp: 500 },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const terminal = fixture.engineCheckpoints.at(-1);

  invariant(terminal !== undefined, 'the fixture always ends on a checkpoint');

  expect(terminal.rewards.xp).toBeGreaterThan(0);

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

test('it settles a run verified in two segments to the terminal total, counting nothing twice', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const terminal = fixture.engineCheckpoints.at(-1);

  invariant(terminal !== undefined, 'the fixture always ends on a checkpoint');

  const totalCheckpoints = fixture.checkpoints.length;
  const midRunCount = totalCheckpoints - 1;

  expect(midRunCount).toBeGreaterThan(0);

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
    logger: pino({ enabled: false }),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const midRun = await ctx.db.transaction().execute((trx) =>
    runFrontier(trx, deps, cache, {
      activityID: fixture.activity.id,
      appendedHead: midRunCount,
      replayAttempts: 0,
      startChainIndex: fixture.activity.startChainIndex,
      status: fixture.activity.status,
      verifiedHead: 0,
    }),
  );

  expect(midRun.kind).toBe('matched');

  const settledMidRun = await ctx.db
    .selectFrom('activities')
    .select('settledXp')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(settledMidRun.settledXp).toBeGreaterThan(0);

  const terminalSegment = await ctx.db.transaction().execute((trx) =>
    runFrontier(trx, deps, cache, {
      activityID: fixture.activity.id,
      appendedHead: fixture.activity.appendedHead,
      replayAttempts: 0,
      startChainIndex: fixture.activity.startChainIndex,
      status: fixture.activity.status,
      verifiedHead: midRunCount,
    }),
  );

  expect(terminalSegment.kind).toBe('matched');

  const avatar = await ctx.db
    .selectFrom('avatars')
    .select(['level', 'xp'])
    .where('id', '=', fixture.activity.avatarId)
    .executeTakeFirstOrThrow();

  expect(avatar.xp).toBe(terminal.rewards.xp);
  expect(avatar.level).toBe(buildLevelFromXP(terminal.rewards.xp));

  const settledFinal = await ctx.db
    .selectFrom('activities')
    .select('settledXp')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(settledFinal.settledXp).toBe(terminal.rewards.xp);
});

test('it settles a matched mid-run segment onto the avatar before the run ends', async () => {
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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  const midRunXP = fixture.engineCheckpoints
    .slice(0, midRunCount)
    .reduce((total, checkpoint) => total + checkpoint.rewards.xp, 0);

  expect(midRunXP).toBeGreaterThan(0);

  const settled = await ctx.db
    .selectFrom('activities')
    .select('settledXp')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(settled.settledXp).toBe(midRunXP);

  const avatar = await ctx.db
    .selectFrom('avatars')
    .select(['level', 'xp'])
    .where('id', '=', fixture.activity.avatarId)
    .executeTakeFirstOrThrow();

  expect(avatar.xp).toBe(midRunXP);
  expect(avatar.level).toBe(buildLevelFromXP(midRunXP));
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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

test("it rejects an activity whose pinned build does not match the avatar's settled xp total", async () => {
  await using ctx = await setupTest();

  const source = await createActivityRow(ctx.db, { status: 'rejected' });

  const fixture = await createHonestActivityFixture(ctx.db, {
    activity: { predecessorActivityId: source.id },
    avatarID: source.avatarId,
    buildSnapshot: { level: buildLevelFromXP(150), xp: 150 },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  // the predecessor's rejection erased the xp this build banked; the avatar's real settled total
  // never reached the pinned build's claim
  await ctx.db
    .updateTable('avatars')
    .set({ xp: 100 })
    .where('id', '=', fixture.activity.avatarId)
    .execute();

  const inMemoryMetrics = createInMemoryMetrics();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
    logger: pino({ enabled: false }),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const outcome = await ctx.db.transaction().execute((trx) =>
    runFrontier(trx, deps, createReplayCache(), {
      activityID: fixture.activity.id,
      appendedHead: fixture.activity.appendedHead,
      replayAttempts: 0,
      startChainIndex: fixture.activity.startChainIndex,
      status: fixture.activity.status,
      verifiedHead: 0,
    }),
  );

  expect(outcome).toStrictEqual({ kind: 'rejected' });

  const activity = await ctx.db
    .selectFrom('activities')
    .select(['status', 'verifiedHead'])
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(activity).toStrictEqual({ status: 'rejected', verifiedHead: 0 });

  const avatar = await ctx.db
    .selectFrom('avatars')
    .select('xp')
    .where('id', '=', fixture.activity.avatarId)
    .executeTakeFirstOrThrow();

  expect(avatar.xp).toBe(100);

  const rejections = await inMemoryMetrics.readCounterDataPoints('vers.verification.rejections');

  expect(rejections).toContainEqual({ attributes: { reason: 'build-mismatch' }, value: 1 });
});

test('it makes no keys dispatch when the frontier has already verified part of the run', async () => {
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
      verifiedHead: firstBatchCount,
    })
    .where('id', '=', fixture.activity.id)
    .execute();

  // a mock that throws proves a segment past its first pass never reads the keys service
  server.use(
    mockKeysService.deriveScopeSecret.handler(() => {
      throw new Error('a segment past verifiedHead 0 must never dispatch to the keys service');
    }),
  );

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
    logger: pino({ enabled: false }),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const outcome = await ctx.db.transaction().execute((trx) =>
    runFrontier(trx, deps, cache, {
      activityID: fixture.activity.id,
      appendedHead: totalCheckpoints,
      replayAttempts: 0,
      startChainIndex: fixture.activity.startChainIndex,
      status: fixture.activity.status,
      verifiedHead: firstBatchCount,
    }),
  );

  expect(outcome.kind).toBe('matched');
});

test('it verifies an honest sealed content-version-2 row, matching its stamped poolID against the derived truth', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    contentVersion: '2',
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const stampedNode = fixture.activity.encounterNode;

  invariant(
    typeof stampedNode === 'object' && stampedNode !== null && 'poolID' in stampedNode,
    'a content-version-2 fixture always stamps a poolID',
  );

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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
});

test("it verifies an honest row sealed under the avatar's own seed, not a shared placeholder", async () => {
  await using ctx = await setupTest();

  // a fixed id and seed, verified against this test's two-pool content to pick a different pool
  // than userSeed 0 would — a verify pass that reverted to a pinned zero seed would recompute the
  // other pool as truth and reject this honest row, rather than matching by coincidence
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_seed_divergent_pool', seed: 700 });

  const document = createMockContentDocument({
    contentVersion: '849851',
    encounter: {
      contentVersion: '849851',
      archetypes: [
        {
          id: 'placeholder-brawler',
          name: 'World Map Enemy',
          baseLevel: 1,
          baseLife: 30,
          baseXP: 10,
          attackMin: 1,
          attackMax: 3,
          attackSpeed: 0.5,
        },
        {
          id: 'placeholder-skirmisher',
          name: 'World Map Skirmisher',
          baseLevel: 1,
          baseLife: 20,
          baseXP: 8,
          attackMin: 1,
          attackMax: 4,
          attackSpeed: 0.7,
        },
      ],
      pools: [
        { id: 'brawler-den', entries: [{ archetypeID: 'placeholder-brawler', weight: 1 }] },
        { id: 'skirmisher-flock', entries: [{ archetypeID: 'placeholder-skirmisher', weight: 1 }] },
      ],
      tuning: {
        waveCountMin: 3,
        waveCountMax: 6,
        waveSizeMin: 3,
        waveSizeMax: 6,
        difficultyScalingFactor: 1,
      },
    },
  });

  const fixture = await createHonestActivityFixture(ctx.db, {
    avatarID: avatar.id,
    document,
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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
});

test("it rejects a tampered stamped poolID with reason 'descriptor-mismatch'", async () => {
  await using ctx = await setupTest();

  // two pools, so the tampered stamp below can name a pool the document registers that still
  // differs from the derived truth
  const document = createMockContentDocument({
    contentVersion: '777001',
    encounter: {
      contentVersion: '777001',
      archetypes: [
        {
          id: 'placeholder-brawler',
          name: 'World Map Enemy',
          baseLevel: 1,
          baseLife: 30,
          baseXP: 10,
          attackMin: 1,
          attackMax: 3,
          attackSpeed: 0.5,
        },
        {
          id: 'placeholder-skirmisher',
          name: 'World Map Skirmisher',
          baseLevel: 1,
          baseLife: 20,
          baseXP: 8,
          attackMin: 1,
          attackMax: 4,
          attackSpeed: 0.7,
        },
      ],
      pools: [
        { id: 'brawler-den', entries: [{ archetypeID: 'placeholder-brawler', weight: 1 }] },
        { id: 'skirmisher-flock', entries: [{ archetypeID: 'placeholder-skirmisher', weight: 1 }] },
      ],
      tuning: {
        waveCountMin: 3,
        waveCountMax: 6,
        waveSizeMin: 3,
        waveSizeMax: 6,
        difficultyScalingFactor: 1,
      },
    },
  });

  const fixture = await createHonestActivityFixture(ctx.db, {
    document,
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const stampedPoolID = fixture.activity.encounterNode;

  invariant(
    typeof stampedPoolID === 'object' && stampedPoolID !== null && 'poolID' in stampedPoolID,
    'a sealed fixture always stamps a poolID',
  );

  const tamperedPoolID = document.encounter.pools.find(
    (pool) => pool.id !== stampedPoolID['poolID'],
  )?.id;

  invariant(tamperedPoolID !== undefined, 'the authored document registers more than one pool');

  await ctx.db
    .updateTable('activities')
    .set({ encounterNode: { difficulty: 1, poolID: tamperedPoolID } })
    .where('id', '=', fixture.activity.id)
    .execute();

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  expect(outcome).toStrictEqual({ kind: 'rejected' });

  const activity = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(activity.status).toBe('rejected');
});

test("it rejects a tampered stamped encounter node on a continuation row, not just a chain's first activity", async () => {
  await using ctx = await setupTest();

  const genesis = await createHonestActivityFixture(ctx.db, {
    // a real mint-and-append only ever opens a continuation once its predecessor has closed —
    // the partial unique index admits one active row per avatar
    activity: { status: 'stopped' },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const continuation = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    rootChain: genesis.chain,
    seed: buildStateFromSeed(1_616_267_014),
  });

  // the fixture stamps each row's default sealed secretRef/secretVersion independently, so the
  // continuation row ends up carrying the same pair a real mint copies forward from the row it
  // appends onto — these assertions pin that alignment
  expect(continuation.activity.secretRef).toBe(genesis.activity.secretRef);
  expect(continuation.activity.avatarId).toBe(genesis.activity.avatarId);

  await ctx.db
    .updateTable('activities')
    .set({ encounterNode: { difficulty: 999 } })
    .where('id', '=', continuation.activity.id)
    .execute();

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
    logger: pino({ enabled: false }),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const outcome = await ctx.db.transaction().execute((trx) =>
    runFrontier(trx, deps, cache, {
      activityID: continuation.activity.id,
      appendedHead: continuation.activity.appendedHead,
      replayAttempts: 0,
      startChainIndex: continuation.activity.startChainIndex,
      status: continuation.activity.status,
      verifiedHead: 0,
    }),
  );

  expect(outcome).toStrictEqual({ kind: 'rejected' });

  const activity = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', continuation.activity.id)
    .executeTakeFirstOrThrow();

  expect(activity.status).toBe('rejected');
});

test('it grants a first_clear keyed by the node when a verified segment completes a world-map-node run', async () => {
  await using ctx = await setupTest();

  // a high build level outlives the default weak content regardless of seed, so this run
  // deterministically reaches a completed terminal rather than a failed one
  const fixture = await createHonestActivityFixture(ctx.db, {
    buildSnapshot: { level: 50, xp: buildXPThreshold(50) },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const terminal = fixture.engineCheckpoints.at(-1);

  invariant(terminal !== undefined, 'the fixture always ends on a checkpoint');

  expect(terminal.type).toBe(ActivityCheckpointType.Completed);
  expect(fixture.chain.scopeType).toBe('world_map_node');

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  // the fixture itself seeds a first-clear grant for a node adjacent to its own scope, so
  // this query isolates the grant this run's own completion earns
  const grants = await ctx.db
    .selectFrom('avatarGrants')
    .selectAll()
    .where('avatarId', '=', fixture.activity.avatarId)
    .where('key', '=', fixture.activity.scopeId)
    .execute();

  expect(grants).toStrictEqual([
    {
      avatarId: fixture.activity.avatarId,
      createdAt: expect.toBeValidDate(),
      key: fixture.activity.scopeId,
      kind: 'first_clear',
    },
  ]);
});

test('it lands no grant when a verified segment ends on a failed terminal', async () => {
  await using ctx = await setupTest();

  const document = createMockContentDocument({
    contentVersion: '868001',
    encounter: {
      contentVersion: '868001',
      archetypes: [
        {
          id: 'overwhelming-brute',
          name: 'Overwhelming Brute',
          baseLevel: 1,
          baseLife: 30,
          baseXP: 10,
          attackMin: 500,
          attackMax: 500,
          attackSpeed: 5,
        },
      ],
      pools: [{ id: 'default', entries: [{ archetypeID: 'overwhelming-brute', weight: 1 }] }],
      tuning: {
        waveCountMin: 3,
        waveCountMax: 6,
        waveSizeMin: 3,
        waveSizeMax: 6,
        difficultyScalingFactor: 1,
      },
    },
  });

  const fixture = await createHonestActivityFixture(ctx.db, {
    document,
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const terminal = fixture.engineCheckpoints.at(-1);

  invariant(terminal !== undefined, 'the fixture always ends on a checkpoint');

  expect(terminal.type).toBe(ActivityCheckpointType.Failed);

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  // the fixture itself seeds a first-clear grant for a node adjacent to its own scope, so
  // this query isolates whether this run's own completion earned one
  const grants = await ctx.db
    .selectFrom('avatarGrants')
    .selectAll()
    .where('avatarId', '=', fixture.activity.avatarId)
    .where('key', '=', fixture.activity.scopeId)
    .execute();

  expect(grants).toBeEmpty();
});

test('it lands no grant when a stop forward-exits the chain without a completed terminal', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'stopped' },
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
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  // the fixture itself seeds a first-clear grant for a node adjacent to its own scope, so
  // this query isolates whether this run's own completion earned one
  const grants = await ctx.db
    .selectFrom('avatarGrants')
    .selectAll()
    .where('avatarId', '=', fixture.activity.avatarId)
    .where('key', '=', fixture.activity.scopeId)
    .execute();

  expect(grants).toBeEmpty();
});

test('it lands no grant when a completed terminal verifies on a non-map-node scope', async () => {
  await using ctx = await setupTest();

  // a high build level outlives the default weak content regardless of seed, so this run
  // deterministically reaches a completed terminal rather than a failed one
  const fixture = await createHonestActivityFixture(ctx.db, {
    buildSnapshot: { level: 50, xp: buildXPThreshold(50) },
    chain: { scopeType: 'encounter' },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const terminal = fixture.engineCheckpoints.at(-1);

  invariant(terminal !== undefined, 'the fixture always ends on a checkpoint');

  expect(terminal.type).toBe(ActivityCheckpointType.Completed);
  expect(fixture.activity.scopeType).toBe('encounter');

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  const grants = await ctx.db
    .selectFrom('avatarGrants')
    .selectAll()
    .where('avatarId', '=', fixture.activity.avatarId)
    .execute();

  expect(grants).toBeEmpty();
});

test('it grants a first_clear exactly once across a re-verification of an already-granted node', async () => {
  await using ctx = await setupTest();

  // a high build level outlives the default weak content regardless of seed, so this run
  // deterministically reaches a completed terminal rather than a failed one
  const fixture = await createHonestActivityFixture(ctx.db, {
    buildSnapshot: { level: 50, xp: buildXPThreshold(50) },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const terminal = fixture.engineCheckpoints.at(-1);

  invariant(terminal !== undefined, 'the fixture always ends on a checkpoint');

  expect(terminal.type).toBe(ActivityCheckpointType.Completed);

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  // replays the same stale frontier, whose `verifiedHead` no longer matches the cursor the first
  // apply already advanced
  const second = await ctx.db
    .transaction()
    .execute((trx) => runFrontier(trx, deps, cache, staleFrontier));

  expect(second.kind).toBe('matched');

  // the fixture itself seeds a first-clear grant for a node adjacent to its own scope, so this
  // query isolates the grant this run's own completion earns
  const grants = await ctx.db
    .selectFrom('avatarGrants')
    .selectAll()
    .where('avatarId', '=', fixture.activity.avatarId)
    .where('key', '=', fixture.activity.scopeId)
    .execute();

  expect(grants).toStrictEqual([
    {
      avatarId: fixture.activity.avatarId,
      createdAt: expect.toBeValidDate(),
      key: fixture.activity.scopeId,
      kind: 'first_clear',
    },
  ]);
});

test('it rejects a settled activity whose node no earlier settled clear made reachable', async () => {
  await using ctx = await setupTest();

  // a completed terminal at '1_0' with no grant making the origin — and thus '1_0' — reachable
  const fixture = await createHonestActivityFixture(ctx.db, {
    buildSnapshot: { level: 50, xp: buildXPThreshold(50) },
    completedNodeIDs: [],
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  expect(outcome).toStrictEqual({ kind: 'rejected' });

  const grants = await ctx.db
    .selectFrom('avatarGrants')
    .selectAll()
    .where('avatarId', '=', fixture.activity.avatarId)
    .execute();

  expect(grants).toStrictEqual([]);
});

test('it verifies a world-map-node run whose scope is connected to a verified first-clear grant, still granting its own completion', async () => {
  await using ctx = await setupTest();

  // the default fixture already seeds a first-clear grant for a node adjacent to its own scope —
  // this asserts that setup directly before proving replay accepts a run built on top of it
  const fixture = await createHonestActivityFixture(ctx.db, {
    buildSnapshot: { level: 50, xp: buildXPThreshold(50) },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const seededGrants = await ctx.db
    .selectFrom('avatarGrants')
    .selectAll()
    .where('avatarId', '=', fixture.activity.avatarId)
    .execute();

  expect(seededGrants).not.toBeEmpty();

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  const activity = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(activity.status).not.toBe('rejected');
});

test('it rejects a world-map-node run whose scope is not connected to any completed node', async () => {
  await using ctx = await setupTest();

  const inMemoryMetrics = createInMemoryMetrics();

  const fixture = await createHonestActivityFixture(ctx.db, {
    buildSnapshot: { level: 50, xp: buildXPThreshold(50) },
    chain: { scopeId: '40_40' },
    completedNodeIDs: [],
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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

  expect(outcome).toStrictEqual({ kind: 'rejected' });

  const activity = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(activity.status).toBe('rejected');

  const rejections = await inMemoryMetrics.readCounterDataPoints('vers.verification.rejections');

  expect(rejections).toContainEqual({ attributes: { reason: 'node-unreachable' }, value: 1 });
});

test('it cascades a build mismatch through a chain of successors, once the run they banked xp from rejects', async () => {
  await using ctx = await setupTest();

  const rejected = await createActivityRow(ctx.db, { status: 'rejected' });

  // each successor's pinned build optimistically banked more of the rejected run's xp than the
  // avatar's settled total actually carries; both are stopped rather than active so they can
  // coexist with each other under the avatar's single-active-run index
  const successorA = await createHonestActivityFixture(ctx.db, {
    activity: { predecessorActivityId: rejected.id, status: 'stopped' },
    avatarID: rejected.avatarId,
    buildSnapshot: { level: buildLevelFromXP(80), xp: 80 },
    duration: 80_000,
    seed: buildStateFromSeed(1_616_267_014),
  });

  const successorB = await createHonestActivityFixture(ctx.db, {
    activity: { predecessorActivityId: successorA.activity.id, status: 'stopped' },
    avatarID: rejected.avatarId,
    buildSnapshot: { level: buildLevelFromXP(120), xp: 120 },
    chain: { scopeId: '55_55' },
    duration: 80_000,
    seed: buildStateFromSeed(2_222_222_222),
  });

  // the fixtures each synced the avatar's settled xp to their own claim in turn; restore it to what
  // it actually is once the borrowed run never settled anything
  await ctx.db.updateTable('avatars').set({ xp: 0 }).where('id', '=', rejected.avatarId).execute();

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
    logger: pino({ enabled: false }),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const outcomeA = await ctx.db.transaction().execute((trx) =>
    runFrontier(trx, deps, cache, {
      activityID: successorA.activity.id,
      appendedHead: successorA.activity.appendedHead,
      replayAttempts: 0,
      startChainIndex: successorA.activity.startChainIndex,
      status: successorA.activity.status,
      verifiedHead: 0,
    }),
  );

  expect(outcomeA).toStrictEqual({ kind: 'rejected' });

  const outcomeB = await ctx.db.transaction().execute((trx) =>
    runFrontier(trx, deps, cache, {
      activityID: successorB.activity.id,
      appendedHead: successorB.activity.appendedHead,
      replayAttempts: 0,
      startChainIndex: successorB.activity.startChainIndex,
      status: successorB.activity.status,
      verifiedHead: 0,
    }),
  );

  expect(outcomeB).toStrictEqual({ kind: 'rejected' });

  const rows = await ctx.db
    .selectFrom('activities')
    .select(['id', 'status'])
    .where('id', 'in', [successorA.activity.id, successorB.activity.id])
    .execute();

  expect(rows).toIncludeSameMembers([
    { id: successorA.activity.id, status: 'rejected' },
    { id: successorB.activity.id, status: 'rejected' },
  ]);
});

test('it settles an unrelated successor once its zero-xp predecessor rejects', async () => {
  await using ctx = await setupTest();

  const predecessor = await createHonestActivityFixture(ctx.db, {
    buildSnapshot: { level: 1, xp: 0 },
    chain: { scopeId: '41_41' },
    completedNodeIDs: [],
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
    logger: pino({ enabled: false }),
    privateKey: ctx.privateKey,
    simVersion: 'test-engine-hash',
  };

  const predecessorOutcome = await ctx.db.transaction().execute((trx) =>
    runFrontier(trx, deps, cache, {
      activityID: predecessor.activity.id,
      appendedHead: predecessor.activity.appendedHead,
      replayAttempts: 0,
      startChainIndex: predecessor.activity.startChainIndex,
      status: predecessor.activity.status,
      verifiedHead: 0,
    }),
  );

  expect(predecessorOutcome).toStrictEqual({ kind: 'rejected' });

  const avatarAfterReject = await ctx.db
    .selectFrom('avatars')
    .select('xp')
    .where('id', '=', predecessor.activity.avatarId)
    .executeTakeFirstOrThrow();

  expect(avatarAfterReject.xp).toBe(0);

  // the successor is an unrelated, honest run that banked none of the rejected predecessor's xp —
  // it settles cleanly despite chaining off a rejected run
  const successor = await createHonestActivityFixture(ctx.db, {
    activity: { predecessorActivityId: predecessor.activity.id },
    avatarID: predecessor.activity.avatarId,
    buildSnapshot: { level: 1, xp: 0 },
    duration: 80_000,
    seed: buildStateFromSeed(1_616_267_014),
  });

  const outcome = await ctx.db.transaction().execute((trx) =>
    runFrontier(trx, deps, cache, {
      activityID: successor.activity.id,
      appendedHead: successor.activity.appendedHead,
      replayAttempts: 0,
      startChainIndex: successor.activity.startChainIndex,
      status: successor.activity.status,
      verifiedHead: 0,
    }),
  );

  expect(outcome.kind).toBe('matched');
});

test('it never rejects a world-map-node run at the origin for reachability, even with no grants', async () => {
  await using ctx = await setupTest();

  const originID = toNodeID(ORIGIN_CELL[0], ORIGIN_CELL[1]);

  const fixture = await createHonestActivityFixture(ctx.db, {
    buildSnapshot: { level: 50, xp: buildXPThreshold(50) },
    chain: { scopeId: originID },
    completedNodeIDs: [],
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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
});

test('it never rejects a non-world_map_node scope for reachability', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    buildSnapshot: { level: 50, xp: buildXPThreshold(50) },
    chain: { scopeType: 'encounter' },
    completedNodeIDs: [],
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const cache = createReplayCache();

  const deps = {
    db: ctx.db,
    keysServiceURL: resolveServiceURL('keys'),
    loadContentDocument: makeContentDocumentLoader(ctx.db),
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
});
