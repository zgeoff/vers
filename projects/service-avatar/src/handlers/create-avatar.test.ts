import { expect, test } from 'bun:test';
import type { AvatarContract } from '@vers/contract-avatar';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { createAvatarService } from '../create-avatar-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createAvatarService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it creates an avatar owned by the acting user', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });
  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const avatar = await client.createAvatar({ class: 'brute', name: 'Brutus' });

  expect(avatar).toStrictEqual({
    class: 'brute',
    createdAt: expect.toBeValidDate(),
    id: expect.toBeString(),
    level: 1,
    name: 'Brutus',
    updatedAt: expect.toBeValidDate(),
    userID: viewer.user.id,
    xp: 0,
  });
});

test('it rejects a second avatar with a duplicate name with CONFLICT', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });
  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  await client.createAvatar({ class: 'brute', name: 'Duplicatus' });

  expect(client.createAvatar({ class: 'scholar', name: 'Duplicatus' })).rejects.toMatchObject({
    code: 'CONFLICT',
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-avatar' });
  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  expect(client.createAvatar({ class: 'brute', name: 'Anonymous' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});
