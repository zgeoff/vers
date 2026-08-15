import { expect, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import type { ActivityContract } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { buildMockScopeSecret } from '@vers/mock-services/keys';
import {
  createActiveAvatarRow,
  createAnonymousViewer,
  createAvatarRow,
  createTestDB,
  createTestUser,
  createViewer,
} from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { deriveWorldmapContent } from '@vers/worldmap-content';
import { findCellCoord, getDifficulty } from '@vers/worldmap-core';
import invariant from 'tiny-invariant';
import { createActivityService } from '../create-activity-service';

/**
 * `revealNodes` opens its own `db.transaction()` for the chain-row mint, which can't nest under
 * the default rollback-on-dispose isolation — this suite runs against a real, committed schema
 * clone instead. Content is seeded here, once, since every test that reveals a node needs a
 * current version to derive its encounter against and none of them vary its shape.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it mints a genesis chain row for a newly revealed node', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0'] });

  expect(result.nodes).toStrictEqual([
    {
      contentVersion: '2',
      encounterNode: expect.toBeObject(),
      genesisSeed: expect.toBeString(),
      head: { chainIndex: 0, nextSeed: expect.toBeString() },
      nodeID: '0_0',
    },
  ]);

  const chain = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  const [entry] = result.nodes;

  invariant(entry, 'revealNodes must return one entry per input node');

  expect(chain.genesisSeed).toBe(entry.genesisSeed);
  expect(chain.appendedNextSeed).toBe(entry.genesisSeed);
  expect(chain.verifiedNextSeed).toBe(entry.genesisSeed);
  expect(entry.head).toStrictEqual({ chainIndex: 0, nextSeed: entry.genesisSeed });
});

test("it returns a revisited node's advanced head rather than its genesis", async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0'] });

  const [genesisEntry] = first.nodes;

  invariant(genesisEntry, 'revealNodes must return one entry per input node');

  await ctx.db
    .updateTable('activityChains')
    .set({ appendedChainIndex: 3, appendedNextSeed: 'advanced_seed' })
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .execute();

  const second = await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0'] });

  const [revisitedEntry] = second.nodes;

  invariant(revisitedEntry, 'revealNodes must return one entry per input node');

  expect(revisitedEntry.genesisSeed).toBe(genesisEntry.genesisSeed);
  expect(revisitedEntry.head).toStrictEqual({ chainIndex: 3, nextSeed: 'advanced_seed' });
});

test('it returns one entry per input node', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.revealNodes({
    avatarID: avatar.id,
    nodeIDs: ['0_0', '1_0', '-1_0'],
  });

  expect(result.nodes.map((entry) => entry.nodeID)).toStrictEqual(['0_0', '1_0', '-1_0']);

  const distinctSeeds = new Set(result.nodes.map((entry) => entry.genesisSeed));

  expect(distinctSeeds.size).toBe(3);
});

test('it mints once for a duplicate node id within one call', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0', '0_0'] });

  expect(result.nodes.map((entry) => entry.nodeID)).toStrictEqual(['0_0', '0_0']);

  const [firstEntry, secondEntry] = result.nodes;

  invariant(firstEntry && secondEntry, 'revealNodes must return one entry per input node');

  expect(firstEntry.genesisSeed).toBe(secondEntry.genesisSeed);
  expect(firstEntry.encounterNode).toStrictEqual(secondEntry.encounterNode);

  const rows = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .execute();

  expect(rows).toHaveLength(1);
});

test('it self-assigns a stable genesis seed and encounter across repeat reveals of the same node', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    id: 'avatar_reveal_idempotency',
    userId: viewer.user.id,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0'] });
  const second = await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0'] });

  // the genesis seed is a CSPRNG mint with no seeded, reproducible source — only its stability
  // across repeat reveals is a property this suite can pin, never the value itself; the encounter
  // and stamps are pure functions of state repeat reveals never change, so the whole response is
  // stable in place
  expect(second).toStrictEqual(first);

  const [entry] = first.nodes;

  invariant(entry, 'revealNodes must return one entry per input node');

  expect(entry.genesisSeed).toMatch(/^[0-9a-f]{32}$/);

  const rows = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .execute();

  expect(rows).toHaveLength(1);
});

test('it converges two concurrent reveals of the same node on one genesis seed', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const [first, second] = await Promise.all([
    client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0'] }),
    client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0'] }),
  ]);

  const [firstEntry] = first.nodes;
  const [secondEntry] = second.nodes;

  invariant(firstEntry && secondEntry, 'revealNodes must return one entry per input node');

  expect(firstEntry.genesisSeed).toBe(secondEntry.genesisSeed);

  const rows = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .execute();

  expect(rows).toHaveLength(1);
});

test("it derives a node's encounter matching startActivity's own sealed derivation for the same coordinate and avatar", async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  // publish this test's own document, moving the current pointer onto it, so the derivation truth
  // asserted below comes from content this test authored rather than the suite's shared seed
  const document = createMockContentDocument();

  await createContentVersion(ctx.db, document);

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['1_0'] });

  const [entry] = result.nodes;

  invariant(entry, 'revealNodes must return one entry per input node');

  const coord = findCellCoord('1_0');

  invariant(coord, 'scope id 1_0 must resolve to a valid cell coordinate');

  const scopeSecret = buildMockScopeSecret(avatar.id, 'worldmap', 1);

  const expected = deriveWorldmapContent(document.encounter, {
    coord,
    scopeSecret,
    userSeed: avatar.seed,
  });

  expect(entry.contentVersion).toBe(document.contentVersion);

  expect(entry.encounterNode).toStrictEqual({
    difficulty: getDifficulty(coord[0], coord[1]),
    poolID: expected.poolID,
  });
});

test('it returns the current key version and scope-secret stamps once for the whole batch', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0', '1_0'] });

  expect(result.keyVersion).toBe(1);
  expect(result.secretRef).toBe('worldmap');
  expect(result.secretVersion).toBe(1);
});

test('it rejects an unregistered node id with NODE_UNKNOWN, minting nothing', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const rejected = client.revealNodes({
    avatarID: avatar.id,
    nodeIDs: ['0_0', 'not_a_real_node'],
  });

  // `.rejects` chains type as synchronous and are ordinarily left unawaited, but the trailing
  // query below must observe the rejected call fully settled — draining it here guarantees that
  // ordering before the DB assertion runs against the settled promise.
  await rejected.catch(() => {});

  expect(rejected).rejects.toMatchObject({ code: 'NODE_UNKNOWN' });

  const rows = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .execute();

  expect(rows).toBeEmpty();
});

test('it rejects a foreign avatar with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const owner = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: owner.user.id });
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0'] })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.revealNodes({ avatarID: 'avatar_1', nodeIDs: ['0_0'] })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

test("it rejects revealing for an avatar that is not the account's active one, naming the active avatar", async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const activeAvatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });
  const otherAvatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActiveAvatarRow(ctx.db, { avatarId: activeAvatar.id, userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.revealNodes({ avatarID: otherAvatar.id, nodeIDs: ['0_0'] })).rejects.toMatchObject({
    code: 'AVATAR_NOT_ACTIVE',
    data: { activeAvatarID: activeAvatar.id, activeAvatarName: activeAvatar.name },
  });
});

test("it rejects revealing an empty batch for an avatar that is not the account's active one", async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const activeAvatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });
  const otherAvatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActiveAvatarRow(ctx.db, { avatarId: activeAvatar.id, userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.revealNodes({ avatarID: otherAvatar.id, nodeIDs: [] })).rejects.toMatchObject({
    code: 'AVATAR_NOT_ACTIVE',
    data: { activeAvatarID: activeAvatar.id, activeAvatarName: activeAvatar.name },
  });
});
