import { expect, test } from 'bun:test';
import { buildCheckpointHash } from '@vers/contract-activity';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createHonestActivityFixture } from './create-honest-activity-fixture';

test('it persists a stream whose stored hashes byte-match a fresh recompute', async () => {
  await using ctx = await createTestDB();

  const fixture = await createHonestActivityFixture(ctx.db, { duration: 80_000 });

  expect(fixture.checkpoints.length).toBeGreaterThan(1);
  expect(fixture.activity.appendedHead).toBe(fixture.checkpoints.length);
  expect(fixture.activity.verifiedHead).toBe(0);

  let prevHash = fixture.activity.startHash;

  for (const checkpoint of fixture.checkpoints) {
    // oxlint-disable typescript/no-unsafe-type-assertion -- the fixture's payload is a hand-built, schema-shaped object
    const recomputed = buildCheckpointHash({
      chainIndex: checkpoint.payload['chainIndex'] as number,
      entropySource: 'server-key',
      nextSeed: checkpoint.payload['nextSeed'] as string,
      prevHash,
      seed: checkpoint.payload['seed'] as string,
      time: checkpoint.payload['time'] as number,
      type: checkpoint.payload['type'] as string,
      version: checkpoint.version,
    });

    // oxlint-enable typescript/no-unsafe-type-assertion

    expect(checkpoint.hash).toBe(recomputed);
    expect(checkpoint.prevHash).toBe(prevHash);

    prevHash = checkpoint.hash;
  }

  const storedRows = await ctx.db
    .selectFrom('activityCheckpoints')
    .selectAll()
    .where('activityId', '=', fixture.activity.id)
    .orderBy('version')
    .execute();

  expect(storedRows).toHaveLength(fixture.checkpoints.length);
});

test('it roots a successor on an already-persisted chain instead of creating a new one', async () => {
  await using ctx = await createTestDB();

  const predecessor = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'stopped' },
    duration: 80_000,
  });

  const tail = predecessor.checkpoints.at(-1);

  expect(tail).toBeDefined();

  // oxlint-disable typescript/no-unsafe-type-assertion -- the fixture's payload is a hand-built, schema-shaped object
  const successor = await createHonestActivityFixture(ctx.db, {
    rootChain: predecessor.chain,
    seed: tail?.payload['nextSeed'] as string,
    startChainIndex: tail?.payload['chainIndex'] as number,
  });

  expect(successor.activity.startChainIndex).toBe(tail?.payload['chainIndex'] as number);
  expect(successor.activity.seed).toBe(tail?.payload['nextSeed'] as string);

  // oxlint-enable typescript/no-unsafe-type-assertion

  expect(successor.activity.avatarId).toBe(predecessor.activity.avatarId);

  const chains = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', predecessor.activity.avatarId)
    .execute();

  expect(chains).toHaveLength(1);
});
