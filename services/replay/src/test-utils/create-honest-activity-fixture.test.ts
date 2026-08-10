import { expect, test } from 'bun:test';
import { buildCheckpointHash } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { buildMockScopeSecret } from '@vers/mock-services/keys';
import { createTestDB } from '@vers/service-test-utils/bun';
import { deriveWorldmapContent } from '@vers/worldmap-content';
import invariant from 'tiny-invariant';
import { createAvatarRow } from './create-avatar-row';
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

test("it seals the stamped encounterNode under the chain's avatar seed, not a shared placeholder", async () => {
  await using ctx = await createTestDB({ isolation: 'schema' });

  // a fixed id and seed, verified against this test's two-pool content to pick a different pool
  // than userSeed 0 would — a fixture that reverted to a pinned zero seed would stamp the other
  // pool and fail the assertion below, rather than passing by coincidence
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_test_849_seed', seed: 777 });

  const document = createMockContentDocument({
    contentVersion: '849850',
    encounter: {
      contentVersion: '849850',
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
  });

  const scopeSecret = buildMockScopeSecret(avatar.id, 'worldmap', 1);

  const sealedUnderZero = deriveWorldmapContent(document.encounter, {
    coord: [1, 0],
    scopeSecret,
    userSeed: 0,
  });

  const sealedUnderAvatarSeed = deriveWorldmapContent(document.encounter, {
    coord: [1, 0],
    scopeSecret,
    userSeed: avatar.seed,
  });

  expect(sealedUnderAvatarSeed.poolID).not.toBe(sealedUnderZero.poolID);

  expect(fixture.activity.encounterNode).toStrictEqual({
    difficulty: 1,
    poolID: sealedUnderAvatarSeed.poolID,
  });
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
