import { expect, test } from 'bun:test';
import type { AvatarContract } from '@vers/contract-avatar';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createAvatarService } from '../create-avatar-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createAvatarService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns an owned avatar by id', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const created = await client.createAvatar({ class: 'brute', name: 'Findable' });

  const found = await client.getAvatar({ id: created.id });

  expect(found).toStrictEqual(created);
});

test('it returns null for an avatar owned by another user', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });
  const other = await createViewer({ audience: 'service-avatar', db: ctx.db });
  const foreign = await createAvatarRow(ctx.db, { name: 'Foreign', userId: other.user.id });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const found = await client.getAvatar({ id: foreign.id });

  expect(found).toBeNull();
});

test('it returns null for an id that does not exist', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const found = await client.getAvatar({ id: 'does-not-exist' });

  expect(found).toBeNull();
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-avatar' });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  expect(client.getAvatar({ id: 'x' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});
