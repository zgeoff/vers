import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import type { Isolation } from '@vers/service-test-utils/bun';
import {
  createAnonymousViewer,
  createTestDB,
  createTestUser,
  createViewer,
} from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';

async function setupTest(options: { readonly isolation?: Isolation } = {}) {
  const db = await createTestDB(options);
  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it starts an activity for an avatar owned by the acting user', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    class: 'scholar',
    level: 5,
    userId: viewer.user.id,
    xp: 42,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const activity = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

  expect(activity).toStrictEqual({
    appendedAt: null,
    appendedHead: 0,
    avatarID: avatar.id,
    buildSnapshot: { class: 'scholar', level: 5, xp: 42 },
    contentVersion: '0.0.0-dev',
    createdAt: expect.toBeValidDate(),
    id: expect.toBeString(),
    lastHash: expect.toBeString(),
    nodeID: 'node_1',
    seed: expect.toBeString(),
    simVersion: '0.0.0-dev',
    startHash: expect.toBeString(),
    startedAt: expect.toBeValidDate(),
    status: 'active',
    stoppedAt: null,
    updatedAt: expect.toBeValidDate(),
    verifiedAt: null,
    verifiedHead: 0,
  });

  expect(activity.lastHash).toBe(activity.startHash);
});

// database isolation: the handler re-queries for the conflicting activity after catching the
// unique violation, and a prior statement's constraint violation aborts the rest of a shared
// test transaction under the default isolation.
test('it rejects a second start with CONFLICT carrying the already-active activity', async () => {
  await using ctx = await setupTest({ isolation: 'database' });

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const first = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

  expect(client.startActivity({ avatarID: avatar.id, nodeID: 'node_2' })).rejects.toMatchObject({
    code: 'CONFLICT',
    data: { activity: { id: first.id } },
  });
});

test('it rejects starting an activity on a foreign avatar with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const owner = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: owner.user.id });
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.startActivity({ avatarID: 'avatar_1', nodeID: 'node_1' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});
