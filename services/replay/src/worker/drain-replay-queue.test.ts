import { expect, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/bun';
import { createContentVersion, makeContentDocumentLoader } from '@vers/content-registry';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { createDB, toJSON } from '@vers/db';
import { buildStateFromSeed } from '@vers/game-utils';
import { resolveServiceURL } from '@vers/mock-services';
import { setSentryHandleForTesting, startErrorReporting } from '@vers/service-runtime';
import { createTestDB, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { waitFor } from '@vers/test-utils';
import pino from 'pino';
import invariant from 'tiny-invariant';
import { createReplayCache } from '../replay/create-replay-cache';
import { createHonestActivityFixture } from '../test-utils/create-honest-activity-fixture';
import { drainReplayQueue } from './drain-replay-queue';

async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

  const keyPair = await getTestServiceKeyPair();

  return {
    db: db.db,
    deps: {
      cache: createReplayCache(),
      db: db.db,
      keysServiceURL: resolveServiceURL('keys'),
      loadContentDocument: makeContentDocumentLoader(db.db),
      logger: pino({ enabled: false }),
      privateKey: keyPair.privateKey,
      simVersion: 'test-engine-hash',
    },
    [Symbol.asyncDispose]: db[Symbol.asyncDispose],
  };
}

test('it returns 0 against an idle queue', async () => {
  await using ctx = await setupTest();

  expect(drainReplayQueue(ctx.deps, 'poke')).resolves.toBe(0);
});

test('it drains a seeded backlog to empty and returns the count', async () => {
  await using ctx = await setupTest();

  const first = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const second = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(1_284_930_112),
  });

  const drained = await drainReplayQueue(ctx.deps, 'poke');

  expect(drained).toBe(2);

  const rows = await ctx.db
    .selectFrom('activities')
    .select(['appendedHead', 'verifiedHead'])
    .where('id', 'in', [first.activity.id, second.activity.id])
    .execute();

  expect(rows.every((row) => row.verifiedHead === row.appendedHead)).toBeTrue();
  expect(drainReplayQueue(ctx.deps, 'poke')).resolves.toBe(0);
});

test('it settles a stream split across two drains to its terminal total and chain anchor', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const totalCheckpoints = fixture.checkpoints.length;
  const firstBatchCount = Math.max(1, Math.floor(totalCheckpoints / 2));

  expect(firstBatchCount).toBeLessThan(totalCheckpoints);

  await ctx.db
    .deleteFrom('activityCheckpoints')
    .where('activityId', '=', fixture.activity.id)
    .where('version', '>', firstBatchCount)
    .execute();

  const firstBatchLastHash = fixture.checkpoints[firstBatchCount - 1]?.hash;

  invariant(
    firstBatchLastHash !== undefined,
    'the fixture always has a checkpoint at the split index',
  );

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: firstBatchCount, lastHash: firstBatchLastHash })
    .where('id', '=', fixture.activity.id)
    .execute();

  const firstDrained = await drainReplayQueue(ctx.deps, 'poke');

  expect(firstDrained).toBe(1);

  const remaining = fixture.checkpoints.slice(firstBatchCount);

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
    .set({ appendedHead: totalCheckpoints, lastHash: fixture.activity.lastHash })
    .where('id', '=', fixture.activity.id)
    .execute();

  const secondDrained = await drainReplayQueue(ctx.deps, 'poke');

  expect(secondDrained).toBe(1);

  const terminal = fixture.engineCheckpoints.at(-1);

  invariant(terminal !== undefined, 'the fixture always ends on a checkpoint');

  const updated = await ctx.db
    .selectFrom('activities')
    .select(['appendedHead', 'settledXp', 'verifiedHead'])
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updated.verifiedHead).toBe(updated.appendedHead);
  expect(updated.settledXp).toBe(terminal.rewards.xp);

  const terminalCheckpoint = fixture.checkpoints.at(-1);

  invariant(terminalCheckpoint !== undefined, 'the fixture always stores a terminal checkpoint');

  const chain = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', fixture.activity.avatarId)
    .where('scopeId', '=', fixture.activity.scopeId)
    .executeTakeFirstOrThrow();

  expect(chain).toStrictEqual({
    verifiedChainIndex: terminalCheckpoint.payload.chainIndex,
    verifiedNextSeed: terminalCheckpoint.payload.nextSeed,
  });
});

test('it verifies a second drain from a fresh cache, reaching the same terminal total', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const totalCheckpoints = fixture.checkpoints.length;
  const firstBatchCount = Math.max(1, Math.floor(totalCheckpoints / 2));

  expect(firstBatchCount).toBeLessThan(totalCheckpoints);

  await ctx.db
    .deleteFrom('activityCheckpoints')
    .where('activityId', '=', fixture.activity.id)
    .where('version', '>', firstBatchCount)
    .execute();

  const firstBatchLastHash = fixture.checkpoints[firstBatchCount - 1]?.hash;

  invariant(
    firstBatchLastHash !== undefined,
    'the fixture always has a checkpoint at the split index',
  );

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: firstBatchCount, lastHash: firstBatchLastHash })
    .where('id', '=', fixture.activity.id)
    .execute();

  const firstDrained = await drainReplayQueue(ctx.deps, 'poke');

  expect(firstDrained).toBe(1);

  const remaining = fixture.checkpoints.slice(firstBatchCount);

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
    .set({ appendedHead: totalCheckpoints, lastHash: fixture.activity.lastHash })
    .where('id', '=', fixture.activity.id)
    .execute();

  const coldDeps = { ...ctx.deps, cache: createReplayCache() };

  const secondDrained = await drainReplayQueue(coldDeps, 'poke');

  expect(secondDrained).toBe(1);

  const terminal = fixture.engineCheckpoints.at(-1);

  invariant(terminal !== undefined, 'the fixture always ends on a checkpoint');

  const updated = await ctx.db
    .selectFrom('activities')
    .select(['appendedHead', 'settledXp', 'verifiedHead'])
    .where('id', '=', fixture.activity.id)
    .executeTakeFirstOrThrow();

  expect(updated.verifiedHead).toBe(updated.appendedHead);
  expect(updated.settledXp).toBe(terminal.rewards.xp);

  const terminalCheckpoint = fixture.checkpoints.at(-1);

  invariant(terminalCheckpoint !== undefined, 'the fixture always stores a terminal checkpoint');

  const chain = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', fixture.activity.avatarId)
    .where('scopeId', '=', fixture.activity.scopeId)
    .executeTakeFirstOrThrow();

  expect(chain).toStrictEqual({
    verifiedChainIndex: terminalCheckpoint.payload.chainIndex,
    verifiedNextSeed: terminalCheckpoint.payload.nextSeed,
  });
});

test('it reuses the same held driver object across two warm drains', async () => {
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

  expect(firstBatchCount).toBeLessThan(secondBatchCount);

  await ctx.db
    .deleteFrom('activityCheckpoints')
    .where('activityId', '=', fixture.activity.id)
    .where('version', '>', firstBatchCount)
    .execute();

  const firstBatchLastHash = fixture.checkpoints[firstBatchCount - 1]?.hash;

  invariant(
    firstBatchLastHash !== undefined,
    'the fixture always has a checkpoint at the split index',
  );

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: firstBatchCount, lastHash: firstBatchLastHash })
    .where('id', '=', fixture.activity.id)
    .execute();

  const firstDrained = await drainReplayQueue(ctx.deps, 'poke');

  expect(firstDrained).toBe(1);

  const cachedAfterFirst = ctx.deps.cache.get(fixture.activity.id);
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

  const secondBatchLastHash = fixture.checkpoints[secondBatchCount - 1]?.hash;

  invariant(
    secondBatchLastHash !== undefined,
    'the fixture always has a checkpoint at the split index',
  );

  await ctx.db
    .updateTable('activities')
    .set({
      appendedHead: secondBatchCount,
      lastHash: secondBatchLastHash,
    })
    .where('id', '=', fixture.activity.id)
    .execute();

  const secondDrained = await drainReplayQueue(ctx.deps, 'poke');

  expect(secondDrained).toBe(1);

  const cachedAfterSecond = ctx.deps.cache.get(fixture.activity.id);

  invariant(cachedAfterFirst !== undefined, 'the first drain caches the driver it built');
  invariant(cachedAfterSecond !== undefined, 'the second drain reuses the cached entry');

  expect(cachedAfterSecond.driver).toBe(cachedAfterFirst.driver);
  expect(cachedAfterSecond.emittedCount).toBe(secondBatchCount);
});

test('it stops draining and reports a claim failure carrying a trace id, without hanging', async () => {
  const unreachableDB = createDB({ databaseURL: 'postgresql://bad:bad@127.0.0.1:1/nope' });

  const keyPair = await getTestServiceKeyPair();

  const recorded: Array<Readonly<ErrorEvent>> = [];
  const previousHandle = setSentryHandleForTesting(undefined);

  onTestFinished(() => {
    setSentryHandleForTesting(previousHandle);
  });

  onTestFinished(async () => {
    await unreachableDB.destroy();
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const drained = await drainReplayQueue(
    {
      cache: createReplayCache(),
      db: unreachableDB,
      keysServiceURL: resolveServiceURL('keys'),
      loadContentDocument: makeContentDocumentLoader(unreachableDB),
      logger: pino({ enabled: false }),
      privateKey: keyPair.privateKey,
      simVersion: 'test-engine-hash',
    },
    'poke',
  );

  expect(drained).toBe(0);

  await waitFor(() => {
    expect(recorded.length).toBeGreaterThan(0);
  });

  expect(recorded[0]?.tags?.['traceID']).toMatch(/^[0-9a-f]{32}$/);
});
