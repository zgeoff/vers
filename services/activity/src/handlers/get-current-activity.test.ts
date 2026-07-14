import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import {
  createAnonymousViewer,
  createTestDB,
  createTestUser,
  createViewer,
} from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { createSimVersionRow } from '../test-utils/create-sim-version-row';

async function setupTest() {
  const db = await createTestDB();

  await createSimVersionRow(db.db);

  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns the active activity for an avatar owned by the acting user', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  const current = await client.getCurrentActivity({ avatarID: avatar.id });

  expect(current).toStrictEqual(started);
});

test('it returns null when the avatar has no active activity', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const current = await client.getCurrentActivity({ avatarID: avatar.id });

  expect(current).toBeNull();
});

test('it returns null for a foreign avatar', async () => {
  await using ctx = await setupTest();

  const owner = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: owner.user.id });
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const current = await client.getCurrentActivity({ avatarID: avatar.id });

  expect(current).toBeNull();
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.getCurrentActivity({ avatarID: 'avatar_1' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});
