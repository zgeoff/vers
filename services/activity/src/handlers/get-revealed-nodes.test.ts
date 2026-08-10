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
import { REVEAL_RADIUS } from '@vers/worldmap-core';
import { createActivityService } from '../create-activity-service';

/**
 * `createContentVersion` opens its own `db.transaction()`, which can't nest under the default
 * rollback-on-dispose isolation — this suite runs against a real, committed schema clone instead.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it discloses content for a verified first-clear node inside the viewport', async () => {
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
    viewport: { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 },
  });

  expect(result.contentVersion).toBe('2');

  expect(result.nodes).toMatchInlineSnapshot(`
    [
      {
        "id": "0_0",
        "poolID": "default",
      },
    ]
  `);
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
