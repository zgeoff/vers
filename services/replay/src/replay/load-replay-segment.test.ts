import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createHonestActivityFixture } from '../test-utils/create-honest-activity-fixture';
import { loadReplaySegment } from './load-replay-segment';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it anchors a genesis segment on the activity startHash and seed', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, { duration: 80_000 });

  const segment = await loadReplaySegment(ctx.db, {
    activityID: fixture.activity.id,
    appendedHead: fixture.activity.appendedHead,
    replayAttempts: 0,
    startChainIndex: fixture.activity.startChainIndex,
    status: fixture.activity.status,
    verifiedHead: 0,
  });

  expect(segment).toBeDefined();
  expect(segment?.prevHash).toBe(fixture.activity.startHash);
  expect(segment?.seed).toBe(fixture.activity.seed);
  expect(segment?.checkpoints).toHaveLength(fixture.checkpoints.length);
  expect(segment?.checkpoints[0]?.version).toBe(1);

  expect(segment?.chain).toStrictEqual({
    genesisSeed: fixture.chain.genesisSeed,
    verifiedChainIndex: fixture.chain.verifiedChainIndex,
    verifiedNextSeed: fixture.chain.verifiedNextSeed,
  });

  expect(segment?.activity).toStrictEqual({
    appendedHead: fixture.activity.appendedHead,
    appendedTimeMs: Number(fixture.activity.appendedTimeMs),
    avatarID: fixture.activity.avatarId,
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: fixture.activity.contentVersion,
    encounterNode: { difficulty: 1 },
    id: fixture.activity.id,
    keyVersion: fixture.activity.keyVersion,
    scopeID: fixture.activity.scopeId,
    scopeType: fixture.activity.scopeType,
    seed: fixture.activity.seed,
    simVersion: fixture.activity.simVersion,
    startChainIndex: fixture.activity.startChainIndex,
    status: fixture.activity.status,
  });
});

test('it anchors a continuation segment on the last verified checkpoint hash and nextSeed', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, { duration: 80_000 });

  const verifiedHead = 1;

  const segment = await loadReplaySegment(ctx.db, {
    activityID: fixture.activity.id,
    appendedHead: fixture.activity.appendedHead,
    replayAttempts: 0,
    startChainIndex: fixture.activity.startChainIndex,
    status: fixture.activity.status,
    verifiedHead,
  });

  const [predecessor] = fixture.checkpoints;

  expect(predecessor).toBeDefined();
  expect(segment?.prevHash).toBe(predecessor?.hash);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fixture's payload is a hand-built, schema-shaped object
  expect(segment?.seed).toBe(predecessor?.payload['nextSeed'] as string | undefined);
  expect(segment?.checkpoints).toHaveLength(fixture.checkpoints.length);
  expect(segment?.checkpoints.slice(verifiedHead)).toHaveLength(fixture.checkpoints.length - 1);
  expect(segment?.checkpoints[verifiedHead]?.version).toBe(2);
});

test('it reports undefined when the activity row is gone', async () => {
  await using ctx = await setupTest();

  const segment = await loadReplaySegment(ctx.db, {
    activityID: 'act_missing',
    appendedHead: 1,
    replayAttempts: 0,
    startChainIndex: 0,
    status: 'active',
    verifiedHead: 0,
  });

  expect(segment).toBeUndefined();
});
