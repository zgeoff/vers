import { expect, test } from 'bun:test';
import { buildStateFromSeed } from '@vers/game-utils';
import { resolveServiceURL } from '@vers/mock-services';
import { createTestDB, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import pino from 'pino';
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
