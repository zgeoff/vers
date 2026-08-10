import { expect, test } from 'bun:test';
import { buildCheckpointHash } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { buildMockScopeSecret } from '@vers/mock-services/keys';
import { createTestDB } from '@vers/service-test-utils/bun';
import { deriveWorldmapContent } from '@vers/worldmap-content';
import invariant from 'tiny-invariant';
import { createHonestActivityFixture } from './create-honest-activity-fixture';

// The fixture publishes the content document it runs the engine against, which opens an
// interactive transaction the default transaction-isolation handle can't nest — every test here
// runs against a real, committed schema clone.
test('it persists a stream whose stored hashes byte-match a fresh recompute', async () => {
  await using ctx = await createTestDB({ isolation: 'schema' });

  const fixture = await createHonestActivityFixture(ctx.db, { duration: 80_000 });

  expect(fixture.checkpoints.length).toBeGreaterThan(1);
  expect(fixture.activity.appendedHead).toBe(fixture.checkpoints.length);
  expect(fixture.activity.verifiedHead).toBe(0);

  let prevHash = fixture.activity.startHash;

  for (const checkpoint of fixture.checkpoints) {
    const recomputed = buildCheckpointHash({
      chainIndex: checkpoint.payload.chainIndex,
      entropySource: 'server-key',
      nextSeed: checkpoint.payload.nextSeed,
      prevHash,
      seed: checkpoint.payload.seed,
      time: checkpoint.payload.time,
      type: checkpoint.payload.type,
      version: checkpoint.version,
    });

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
  await using ctx = await createTestDB({ isolation: 'schema' });

  const predecessor = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'stopped' },
    duration: 80_000,
  });

  const tail = predecessor.checkpoints.at(-1);

  invariant(tail, 'the fixture always stores at least one checkpoint');

  const successor = await createHonestActivityFixture(ctx.db, {
    rootChain: predecessor.chain,
    seed: tail.payload.nextSeed,
    startChainIndex: tail.payload.chainIndex,
  });

  expect(successor.activity.startChainIndex).toBe(tail.payload.chainIndex);
  expect(successor.activity.seed).toBe(tail.payload.nextSeed);
  expect(successor.activity.avatarId).toBe(predecessor.activity.avatarId);

  const chains = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', predecessor.activity.avatarId)
    .execute();

  expect(chains).toHaveLength(1);
});

test('it stamps secretRef/secretVersion and a sealed encounterNode matching real derivation truth by default', async () => {
  await using ctx = await createTestDB({ isolation: 'schema' });

  const document = createMockContentDocument();

  const fixture = await createHonestActivityFixture(ctx.db, { document, duration: 80_000 });

  expect(fixture.activity.secretRef).toBe('worldmap');
  expect(fixture.activity.secretVersion).toBe(1);

  const scopeSecret = buildMockScopeSecret(fixture.activity.avatarId, 'worldmap', 1);

  const avatarRow = await ctx.db
    .selectFrom('avatars')
    .select('seed')
    .where('id', '=', fixture.activity.avatarId)
    .executeTakeFirstOrThrow();

  const expected = {
    difficulty: 1,
    ...deriveWorldmapContent(document.encounter, {
      coord: [1, 0],
      scopeSecret,
      userSeed: avatarRow.seed,
    }),
  };

  expect(fixture.activity.encounterNode).toStrictEqual(expected);
});

test('it publishes the document it ran the engine against, keyed by the stamped content version', async () => {
  await using ctx = await createTestDB({ isolation: 'schema' });

  const document = createMockContentDocument();

  const fixture = await createHonestActivityFixture(ctx.db, { document, duration: 80_000 });

  expect(fixture.activity.contentVersion).toBe(document.contentVersion);

  const stored = await ctx.db
    .selectFrom('contentVersions')
    .select('document')
    .where('contentVersion', '=', document.contentVersion)
    .executeTakeFirstOrThrow();

  expect(stored.document).toStrictEqual(document);
});
