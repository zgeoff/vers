import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it stops the active activity for an avatar owned by the acting user', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });
  const stopped = await client.stopActivity({ avatarID: avatar.id });

  expect(stopped).toStrictEqual({
    ...started,
    status: 'stopped',
    stoppedAt: expect.toBeValidDate(),
    updatedAt: expect.toBeValidDate(),
  });
});

test('it rejects stopping when nothing is active for that avatar with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.stopActivity({ avatarID: avatar.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.stopActivity({ avatarID: 'avatar_1' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});
