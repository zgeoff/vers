import { expect, test } from 'bun:test';
import type { AvatarContract } from '@vers/contract-avatar';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { createAvatarService } from '../create-avatar-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createAvatarService({ db: db.db });
  const app = service.app;

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it lists only the acting user avatars', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });
  const token = viewer.token;
  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token });

  await client.createAvatar({ class: 'brute', name: 'OwnerAvatarOne' });
  await client.createAvatar({ class: 'scholar', name: 'OwnerAvatarTwo' });

  const avatars = await client.getAvatars({});

  expect(avatars.map((avatar) => avatar.name)).toIncludeSameMembers([
    'OwnerAvatarOne',
    'OwnerAvatarTwo',
  ]);
});

test('it excludes avatars owned by another user', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });
  const token = viewer.token;
  const other = await createViewer({ audience: 'service-avatar', db: ctx.db });

  await createAvatarRow(ctx.db, { name: 'NotYours', userId: other.user.id });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token });
  const avatars = await client.getAvatars({});

  expect(avatars).toBeEmpty();
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-avatar' });
  const token = viewer.token;
  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token });

  expect(client.getAvatars({})).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});
