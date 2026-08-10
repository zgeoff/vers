import { expect, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import type { ActivityContract } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import {
  createAnonymousViewer,
  createAvatarRow,
  createTestDB,
  createViewer,
} from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { REVEAL_RADIUS, WORLD_COORD_MAX } from '@vers/worldmap-core';
import { createActivityService } from '../create-activity-service';

/**
 * `createContentVersion` opens its own `db.transaction()`, which can't nest under the default
 * rollback-on-dispose isolation — this suite runs against a real, committed schema clone instead.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createContentVersion(
    db.db,
    createMockContentDocument({
      contentVersion: '2',

      // four pools, so a disclosed `poolID` pins which pool the sealed derivation actually picked
      // rather than echoing the single pool a minimal document would always return regardless of
      // the coordinate, avatar seed, or scope secret fed into it
      encounter: {
        contentVersion: '2',
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
          { id: 'pool-a', entries: [{ archetypeID: 'placeholder-brawler', weight: 1 }] },
          { id: 'pool-b', entries: [{ archetypeID: 'placeholder-skirmisher', weight: 1 }] },
          {
            id: 'pool-c',
            entries: [
              { archetypeID: 'placeholder-brawler', weight: 1 },
              { archetypeID: 'placeholder-skirmisher', weight: 1 },
            ],
          },
          {
            id: 'pool-d',
            entries: [
              { archetypeID: 'placeholder-skirmisher', weight: 1 },
              { archetypeID: 'placeholder-brawler', weight: 1 },
            ],
          },
        ],
        tuning: {
          waveCountMin: 3,
          waveCountMax: 6,
          waveSizeMin: 3,
          waveSizeMax: 6,
          difficultyScalingFactor: 1,
        },
      },
    }),
  );

  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it discloses content pinned to the sealed derivation for every cell a verified first-clear disc covers', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    id: 'avatar_reveal_happy_path',
    seed: 700,
    userId: viewer.user.id,
  });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: '0_0', kind: 'first_clear' })
    .execute();

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.getRevealedNodes({
    avatarID: avatar.id,
    viewport: { maxCX: 2, maxCY: 0, minCX: -2, minCY: 0 },
  });

  expect(result.contentVersion).toBe('2');

  // distinct cells landing on distinct pools, rather than every cell echoing the same pool id,
  // is what proves the coordinate actually reaches the sealed derivation
  expect(result.nodes).toMatchInlineSnapshot(`
    [
      {
        "id": "0_0",
        "poolID": "pool-a",
      },
      {
        "id": "-1_0",
        "poolID": "pool-c",
      },
      {
        "id": "1_0",
        "poolID": "pool-c",
      },
      {
        "id": "-2_0",
        "poolID": "pool-a",
      },
      {
        "id": "2_0",
        "poolID": "pool-b",
      },
    ]
  `);
});

test('it derives different pool assignments for the same cell across avatars with different seeds', async () => {
  await using ctx = await setupTest();

  const viewerA = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatarA = await createAvatarRow(ctx.db, {
    id: 'avatar_reveal_seed_a',
    seed: 111,
    userId: viewerA.user.id,
  });

  const viewerB = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatarB = await createAvatarRow(ctx.db, {
    id: 'avatar_reveal_seed_b',
    seed: 222,
    userId: viewerB.user.id,
  });

  await ctx.db
    .insertInto('avatarGrants')
    .values([
      { avatarId: avatarA.id, key: '0_0', kind: 'first_clear' },
      { avatarId: avatarB.id, key: '0_0', kind: 'first_clear' },
    ])
    .execute();

  const clientA = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewerA.token });
  const clientB = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewerB.token });
  const viewport = { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 };

  const resultA = await clientA.getRevealedNodes({ avatarID: avatarA.id, viewport });
  const resultB = await clientB.getRevealedNodes({ avatarID: avatarB.id, viewport });

  expect(resultA.nodes).toMatchInlineSnapshot(`
    [
      {
        "id": "0_0",
        "poolID": "pool-c",
      },
    ]
  `);

  expect(resultB.nodes).toMatchInlineSnapshot(`
    [
      {
        "id": "0_0",
        "poolID": "pool-a",
      },
    ]
  `);

  expect(resultA.nodes.map((node) => node.poolID)).not.toStrictEqual(
    resultB.nodes.map((node) => node.poolID),
  );
});

test('it discloses a cell exactly REVEAL_RADIUS hops from a first-clear node', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: '0_0', kind: 'first_clear' })
    .execute();

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.getRevealedNodes({
    avatarID: avatar.id,
    viewport: { maxCX: REVEAL_RADIUS, maxCY: 0, minCX: REVEAL_RADIUS, minCY: 0 },
  });

  expect(result.nodes.map((node) => node.id)).toStrictEqual([`${REVEAL_RADIUS}_0`]);
});

test('it excludes a cell inside the viewport but outside every reveal disc', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: '0_0', kind: 'first_clear' })
    .execute();

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });
  const oneHopPastTheRadius = REVEAL_RADIUS + 1;

  const result = await client.getRevealedNodes({
    avatarID: avatar.id,
    viewport: {
      maxCX: oneHopPastTheRadius,
      maxCY: 0,
      minCX: oneHopPastTheRadius,
      minCY: 0,
    },
  });

  expect(result.contentVersion).toBe('2');
  expect(result.nodes).toBeEmpty();
});

test('it unions discs from more than one first-clear grant, leaving the gap between them unrevealed', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await ctx.db
    .insertInto('avatarGrants')
    .values([
      { avatarId: avatar.id, key: '0_0', kind: 'first_clear' },
      { avatarId: avatar.id, key: '6_0', kind: 'first_clear' },
    ])
    .execute();

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.getRevealedNodes({
    avatarID: avatar.id,
    viewport: { maxCX: 6, maxCY: 0, minCX: 0, minCY: 0 },
  });

  // the two radius-2 discs cover cx 0-2 and cx 4-6 on this row; cx 3 sits in the gap between them
  expect(result.nodes.map((node) => node.id).toSorted()).toStrictEqual([
    '0_0',
    '1_0',
    '2_0',
    '4_0',
    '5_0',
    '6_0',
  ]);
});

test('it ignores a grant whose kind is not first_clear', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: '0_0', kind: 'cosmetic_unlock' })
    .execute();

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.getRevealedNodes({
    avatarID: avatar.id,
    viewport: { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 },
  });

  expect(result.nodes).toBeEmpty();
});

test('it skips a first-clear grant key that is not a world-map node id', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await ctx.db
    .insertInto('avatarGrants')
    .values([
      { avatarId: avatar.id, key: 'not_a_node_id', kind: 'first_clear' },
      { avatarId: avatar.id, key: '0_0', kind: 'first_clear' },
    ])
    .execute();

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.getRevealedNodes({
    avatarID: avatar.id,
    viewport: { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 },
  });

  expect(result.nodes.map((node) => node.id)).toStrictEqual(['0_0']);
});

test('it skips a first-clear grant naming a cell past the packable coordinate range', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: `${WORLD_COORD_MAX + 1}_0`, kind: 'first_clear' })
    .execute();

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  // the disc around that grant would otherwise reach these addressable cells at the edge of the map
  const result = await client.getRevealedNodes({
    avatarID: avatar.id,
    viewport: { maxCX: WORLD_COORD_MAX, maxCY: 0, minCX: WORLD_COORD_MAX - 1, minCY: 0 },
  });

  expect(result.nodes).toBeEmpty();
});

test('it reveals nothing for a second avatar of the same user that holds no first-clear grant', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const granted = await createAvatarRow(ctx.db, { userId: viewer.user.id });
  const ungranted = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: granted.id, key: '0_0', kind: 'first_clear' })
    .execute();

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });
  const viewport = { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 };

  const grantedResult = await client.getRevealedNodes({ avatarID: granted.id, viewport });
  const ungrantedResult = await client.getRevealedNodes({ avatarID: ungranted.id, viewport });

  expect(grantedResult.nodes.map((node) => node.id)).toStrictEqual(['0_0']);
  expect(ungrantedResult.nodes).toBeEmpty();
});

test('it rejects a foreign avatar with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const owner = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: owner.user.id });
  const otherViewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: otherViewer.token });

  expect(
    client.getRevealedNodes({
      avatarID: avatar.id,
      viewport: { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 },
    }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it rejects a missing avatar with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.getRevealedNodes({
      avatarID: 'avatar_never_created',
      viewport: { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 },
    }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.getRevealedNodes({
      avatarID: 'avatar_1',
      viewport: { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 },
    }),
  ).rejects.toMatchObject({ code: 'UNAUTHORIZED', data: { reason: 'missing-session' } });
});
