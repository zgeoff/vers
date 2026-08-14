import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import {
  createActiveAvatarRow,
  createAnonymousViewer,
  createAvatarRow,
  createTestDB,
  createTestUser,
  createViewer,
} from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import invariant from 'tiny-invariant';
import { createActivityService } from '../create-activity-service';

/**
 * `revealNodes` opens its own `db.transaction()` for the chain-row mint, which can't nest under
 * the default rollback-on-dispose isolation — this suite runs against a real, committed schema
 * clone instead.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });
  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it mints a genesis chain row for a newly revealed node', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0'] });

  expect(result).toStrictEqual([{ genesisSeed: expect.toBeString(), nodeID: '0_0' }]);

  const chain = await ctx.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', '0_0')
    .executeTakeFirstOrThrow();

  const [entry] = result;

  invariant(entry, 'revealNodes must return one entry per input node');

  expect(chain.genesisSeed).toBe(entry.genesisSeed);
  expect(chain.appendedNextSeed).toBe(entry.genesisSeed);
  expect(chain.verifiedNextSeed).toBe(entry.genesisSeed);
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

  expect(result.map((entry) => entry.nodeID)).toStrictEqual(['0_0', '1_0', '-1_0']);

  const distinctSeeds = new Set(result.map((entry) => entry.genesisSeed));

  expect(distinctSeeds.size).toBe(3);
});

test('it mints once for a duplicate node id within one call', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.revealNodes({ avatarID: avatar.id, nodeIDs: ['0_0', '0_0'] });

  expect(result).toStrictEqual([
    { genesisSeed: expect.toBeString(), nodeID: '0_0' },
    { genesisSeed: expect.toBeString(), nodeID: '0_0' },
  ]);

  const [firstEntry, secondEntry] = result;

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

test('it self-assigns a stable genesis seed across repeat reveals of the same node', async () => {
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
  // across repeat reveals is a property this suite can pin, never the value itself
  expect(second).toStrictEqual(first);

  const [entry] = first;

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

  const [firstEntry] = first;
  const [secondEntry] = second;

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
