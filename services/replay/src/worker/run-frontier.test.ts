import { expect, test } from 'bun:test';
import { createContentVersion, makeContentDocumentLoader } from '@vers/content-registry';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { buildStateFromSeed } from '@vers/game-utils';
import { buildLevelFromXP } from '@vers/idle-core';
import { resolveServiceURL } from '@vers/mock-services';
import { mockKeysService } from '@vers/mock-services/keys';
import { createTestDB, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import pino from 'pino';
import invariant from 'tiny-invariant';
import { server } from '../mocks/server';
import { createReplayCache } from '../replay/create-replay-cache';
import { createActivityRow } from '../test-utils/create-activity-row';
import { createHonestActivityFixture } from '../test-utils/create-honest-activity-fixture';
import { createSnapshotSourceRow } from '../test-utils/create-snapshot-source-row';
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

test('it refuses an activity whose build snapshot borrowed xp from a rejected run', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const source = await createActivityRow(ctx.db, {
    avatarId: fixture.activity.avatarId,
    scopeId: 'scope_lender',
    status: 'rejected',
  });

  await createSnapshotSourceRow(ctx.db, {
    activityID: fixture.activity.id,
    sourceActivityID: source.id,
  });

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

  expect(avatar.xp).toBe(0);
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
