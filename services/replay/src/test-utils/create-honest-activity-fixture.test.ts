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
